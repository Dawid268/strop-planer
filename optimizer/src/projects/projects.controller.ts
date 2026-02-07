import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

import { ProjectsService } from '@/projects/projects.service';
import { FormworkService } from '@/formwork/formwork.service';
import { JwtGuard } from '@/auth/guards';
import {
  CreateProjectDto,
  UpdateProjectDto,
  ProjectResponseDto,
} from '@/projects/dto/project.dto';
import { GetCurrentUserId } from '@/common/decorators';
import {
  PaginationQueryDto,
  PaginatedResponse,
} from '@/common/dto/pagination.dto';
import {
  FormworkLayout,
  OptimizationResult,
} from '@/formwork/interfaces/formwork.interface';
import { ExtractedPdfData } from '@/slab/interfaces/slab.interface';
import { FormworkProjectEntity } from '@/inventory/entities/formwork-project.entity';
import {
  EditorData,
  ExtractedSlabGeometry,
} from '@/projects/interfaces/project.interface';
import { DxfConversionService } from '@/floor-plan/dxf-conversion.service';
import { FabricConverterService } from '@/projects/fabric-converter.service';

/**
 * Projects Controller
 * Manages formwork calculation projects for authenticated users
 */
@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller({ version: '1', path: 'projects' })
export class ProjectsController {
  public constructor(
    private readonly projectsService: ProjectsService,
    private readonly formworkService: FormworkService,
    private readonly dxfConversionService: DxfConversionService,
    private readonly fabricConverterService: FabricConverterService,
  ) {}

  /**
   * Retry generating DXF/GeoJSON artifacts when project has sourcePdfPath but null dxfPath/geoJsonPath
   */
  @Post(':id/retry-artifacts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Wznów generowanie artefaktów',
    description:
      'Ponawia konwersję PDF→DXF→JSON gdy projekt ma sourcePdfPath ale brak dxfPath/geoJsonPath (max 3 próby).',
  })
  @ApiParam({ name: 'id', description: 'UUID projektu', type: String })
  @ApiResponse({
    status: 200,
    description: 'Artefakty wygenerowane',
    type: ProjectResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Brak PDF lub artefakty już istnieją',
  })
  @ApiResponse({ status: 404, description: 'Projekt nie znaleziony' })
  public async retryArtifacts(
    @Param('id', ParseUUIDPipe) id: string,
    @GetCurrentUserId() userId: string,
  ): Promise<ProjectResponseDto> {
    const project = await this.projectsService.findOne(id, userId);

    if (!project.sourcePdfPath) {
      throw new BadRequestException(
        'Projekt nie ma zapisanego pliku PDF. Najpierw prześlij PDF (upload).',
      );
    }

    if (project.dxfPath && project.geoJsonPath) {
      return this.mapToResponse(project);
    }

    const absolutePdfPath = path.join(
      process.cwd(),
      project.sourcePdfPath.startsWith('/')
        ? project.sourcePdfPath.slice(1)
        : project.sourcePdfPath,
    );

    const documentId = path.parse(absolutePdfPath).name;
    const uploadDir = path.dirname(absolutePdfPath);
    const convertedDir = path.join(process.cwd(), 'uploads', 'converted');
    const dxfPathAbs = path.join(uploadDir, `${documentId}.dxf`);
    const jsonPathAbs = path.join(convertedDir, `${documentId}.json`);
    const dxfPathRel = `/uploads/${documentId}.dxf`;
    const jsonPathRel = `/uploads/converted/${documentId}.json`;

    const MAX_ATTEMPTS = 3;
    const RETRY_DELAY_MS = 1500;
    let jsonData:
      | Awaited<ReturnType<DxfConversionService['parseDxfFile']>>
      | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await this.dxfConversionService.convertPdfToDxf(
          absolutePdfPath,
          dxfPathAbs,
        );
        jsonData = await this.dxfConversionService.parseDxfFile(dxfPathAbs);
        await fs.mkdir(convertedDir, { recursive: true });
        await fs.writeFile(jsonPathAbs, JSON.stringify(jsonData, null, 2));
        break;
      } catch (err) {
        if (attempt === MAX_ATTEMPTS) {
          throw new InternalServerErrorException(
            `Konwersja PDF→DXF nie powiodła się po ${MAX_ATTEMPTS} próbach. Sprawdź logi.`,
          );
        }
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }

    await this.projectsService.updateArtifactPaths(
      id,
      { dxfPath: dxfPathRel, geoJsonPath: jsonPathRel },
      userId,
    );

    const updatedProject = await this.projectsService.findOne(id, userId);
    return this.mapToResponse(updatedProject);
  }

  /**
   * Get all projects with pagination
   */
  @Get()
  @ApiOperation({
    summary: 'Lista projektów użytkownika',
    description:
      'Zwraca paginowaną listę wszystkich projektów należących do zalogowanego użytkownika.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numer strony (domyślnie: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Liczba elementów na stronę (domyślnie: 20, max: 100)',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista projektów z metadanymi paginacji',
    type: [ProjectResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: 'Brak autoryzacji - wymagany token JWT',
  })
  public async getProjects(
    @GetCurrentUserId() userId: string,
    @Query() pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<ProjectResponseDto>> {
    const { data, total } = await this.projectsService.findAllPaginated(
      userId,
      pagination.page ?? 1,
      pagination.limit ?? 20,
    );
    const totalPages = Math.ceil(total / (pagination.limit ?? 20));

    return {
      data: data.map((p) => this.mapToResponse(p)),
      meta: {
        total,
        page: pagination.page ?? 1,
        limit: pagination.limit ?? 20,
        totalPages,
        hasNextPage: (pagination.page ?? 1) < totalPages,
        hasPreviousPage: (pagination.page ?? 1) > 1,
      },
    };
  }

  /**
   * Get project statistics
   */
  @Get('stats')
  @ApiOperation({
    summary: 'Statystyki projektów',
    description:
      'Zwraca zagregowane statystyki wszystkich projektów użytkownika.',
  })
  @ApiResponse({
    status: 200,
    description: 'Statystyki projektów',
    schema: {
      type: 'object',
      properties: {
        totalProjects: { type: 'number', example: 15 },
        completedProjects: { type: 'number', example: 8 },
        inProgressProjects: { type: 'number', example: 5 },
        draftProjects: { type: 'number', example: 2 },
        totalSlabArea: { type: 'number', example: 1250.5 },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Brak autoryzacji' })
  public async getStats(@GetCurrentUserId() userId: string) {
    return this.projectsService.getStats(userId);
  }

  /**
   * Get single project by ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Pobierz projekt',
    description: 'Zwraca szczegóły projektu o podanym ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID projektu',
    type: String,
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Szczegóły projektu',
    type: ProjectResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Brak autoryzacji' })
  @ApiResponse({ status: 404, description: 'Projekt nie znaleziony' })
  public async getProjectById(
    @Param('id', ParseUUIDPipe) id: string,
    @GetCurrentUserId() userId: string,
  ): Promise<ProjectResponseDto> {
    const project = await this.projectsService.findOne(id, userId);
    return this.mapToResponse(project);
  }

  /**
   * Create new project
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Utwórz projekt',
    description: 'Tworzy nowy projekt szalunkowy z podanymi parametrami.',
  })
  @ApiBody({ type: CreateProjectDto })
  @ApiResponse({
    status: 201,
    description: 'Projekt utworzony pomyślnie',
    type: ProjectResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Błędne dane wejściowe' })
  @ApiResponse({ status: 401, description: 'Brak autoryzacji' })
  public async createProject(
    @Body() dto: CreateProjectDto,
    @GetCurrentUserId() userId: string,
  ): Promise<ProjectResponseDto> {
    const project = await this.projectsService.create(dto, userId);
    return this.mapToResponse(project);
  }

  /**
   * Update existing project
   */
  @Put(':id')
  @ApiOperation({
    summary: 'Aktualizuj projekt',
    description: 'Aktualizuje istniejący projekt o podanym ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID projektu do aktualizacji',
    type: String,
  })
  @ApiBody({ type: UpdateProjectDto })
  @ApiResponse({
    status: 200,
    description: 'Projekt zaktualizowany',
    type: ProjectResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Błędne dane wejściowe' })
  @ApiResponse({ status: 401, description: 'Brak autoryzacji' })
  @ApiResponse({ status: 404, description: 'Projekt nie znaleziony' })
  public async updateProject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @GetCurrentUserId() userId: string,
  ): Promise<ProjectResponseDto> {
    const project = await this.projectsService.update(id, dto, userId);
    return this.mapToResponse(project);
  }

  /**
   * Delete project
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Usuń projekt',
    description: 'Trwale usuwa projekt o podanym ID.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID projektu do usunięcia',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Projekt usunięty',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Projekt 550e8400-... usunięty' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Brak autoryzacji' })
  @ApiResponse({ status: 404, description: 'Projekt nie znaleziony' })
  public async deleteProject(
    @Param('id', ParseUUIDPipe) id: string,
    @GetCurrentUserId() userId: string,
  ): Promise<{ message: string }> {
    await this.projectsService.delete(id, userId);
    return { message: `Projekt ${id} usunięty` };
  }

  /**
   * Trigger formwork calculation for project
   */
  @Post(':id/calculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Oblicz szalunek',
    description:
      'Uruchamia obliczenia szalunkowe dla projektu. Wymaga uzupełnionych wymiarów stropu.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID projektu',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Obliczenia zakończone pomyślnie',
    type: ProjectResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Brak wymaganych wymiarów stropu',
  })
  @ApiResponse({ status: 401, description: 'Brak autoryzacji' })
  @ApiResponse({ status: 404, description: 'Projekt nie znaleziony' })
  public async triggerCalculation(
    @Param('id', ParseUUIDPipe) id: string,
    @GetCurrentUserId() userId: string,
  ): Promise<ProjectResponseDto> {
    const project = await this.projectsService.findOne(id, userId);

    if (!project.slabLength || !project.slabWidth || !project.slabThickness) {
      throw new BadRequestException(
        'Projekt wymaga wymiarów stropu (slabLength, slabWidth, slabThickness)',
      );
    }

    const slabArea = project.slabLength * project.slabWidth;

    const slabData = {
      id: project.id,
      dimensions: {
        length: project.slabLength,
        width: project.slabWidth,
        thickness: project.slabThickness,
        area: slabArea,
      },
      type: project.slabType || 'monolityczny',
      beams: [],
      reinforcement: [],
      axes: { horizontal: [], vertical: [] },
    };

    const params = {
      slabArea,
      slabThickness: project.slabThickness,
      floorHeight: project.floorHeight,
      includeBeams: true,
      preferredSystem: project.formworkSystem as
        | 'PERI_SKYDECK'
        | 'DOKA_DOKAFLEX'
        | 'ULMA_ENKOFLEX'
        | 'MEVA'
        | 'CUSTOM'
        | undefined,
    };

    const calculationResult = await this.formworkService.calculateFormwork(
      slabData,
      params,
    );

    await this.projectsService.saveCalculationResult(
      id,
      userId,
      JSON.stringify(calculationResult),
    );

    const updatedProject = await this.projectsService.findOne(id, userId);
    return this.mapToResponse(updatedProject);
  }

  /**
   * Save calculation result
   */
  @Post(':id/calculation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Zapisz wynik obliczeń',
    description: 'Zapisuje wynik obliczeń szalunkowych dla projektu.',
  })
  @ApiParam({ name: 'id', description: 'UUID projektu', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        result: { type: 'object', description: 'Wynik obliczeń szalunkowych' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Wynik zapisany' })
  @ApiResponse({ status: 401, description: 'Brak autoryzacji' })
  @ApiResponse({ status: 404, description: 'Projekt nie znaleziony' })
  public async saveCalculation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('result') result: unknown,
    @GetCurrentUserId() userId: string,
  ) {
    return this.projectsService.saveCalculationResult(
      id,
      userId,
      JSON.stringify(result),
    );
  }

  /**
   * Save optimization result
   */
  @Post(':id/optimization')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Zapisz wynik optymalizacji',
    description: 'Zapisuje wynik optymalizacji układu szalunkowego.',
  })
  @ApiParam({ name: 'id', description: 'UUID projektu', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        result: { type: 'object', description: 'Wynik optymalizacji' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Wynik zapisany' })
  @ApiResponse({ status: 401, description: 'Brak autoryzacji' })
  @ApiResponse({ status: 404, description: 'Projekt nie znaleziony' })
  public async saveOptimization(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('result') result: unknown,
    @GetCurrentUserId() userId: string,
  ) {
    return this.projectsService.saveOptimizationResult(
      id,
      userId,
      JSON.stringify(result),
    );
  }

  /**
   * Get editor data
   */
  @Get(':id/editor-data')
  @ApiOperation({
    summary: 'Pobierz dane edytora',
    description: 'Zwraca dane graficznego edytora (warstwy, kształty).',
  })
  @ApiParam({ name: 'id', description: 'UUID projektu', type: String })
  @ApiResponse({
    status: 200,
    description: 'Dane edytora',
    schema: {
      type: 'object',
      properties: {
        layers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              visible: { type: 'boolean' },
              shapes: { type: 'array', items: { type: 'object' } },
            },
          },
        },
        selectedLayerId: { type: 'string', nullable: true },
        metadata: { type: 'object', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Brak autoryzacji' })
  @ApiResponse({ status: 404, description: 'Projekt nie znaleziony' })
  public async getEditorData(
    @Param('id', ParseUUIDPipe) id: string,
    @GetCurrentUserId() userId: string,
  ): Promise<EditorData | null> {
    const project = await this.projectsService.findOne(id, userId);
    return project.editorData
      ? (JSON.parse(project.editorData) as EditorData)
      : null;
  }

  /**
   * Get CAD data formatted for Fabric.js
   */
  @Get(':id/cad-data')
  @ApiOperation({
    summary: 'Pobierz dane CAD dla Fabric.js',
    description:
      'Konwertuje dane DXF na obiekty gotowe do wyświetlenia w Fabric.js.',
  })
  @ApiParam({ name: 'id', description: 'UUID projektu', type: String })
  @ApiResponse({ status: 200, description: 'Dane CAD dla Fabric.js' })
  @ApiResponse({ status: 404, description: 'Projekt nie znaleziony' })
  public async getCadData(
    @Param('id', ParseUUIDPipe) id: string,
    @GetCurrentUserId() userId: string,
  ) {
    const project = await this.projectsService.findOne(id, userId);

    if (!project.dxfPath) {
      throw new BadRequestException('Projekt nie posiada pliku DXF.');
    }

    const documentId = path.parse(project.dxfPath).name;
    const dxfData =
      await this.dxfConversionService.getFloorPlanData(documentId);

    return this.fabricConverterService.convertToFabric(dxfData);
  }

  /**
   * Save editor data
   */
  @Put(':id/editor-data')
  @ApiOperation({
    summary: 'Zapisz dane edytora',
    description: 'Zapisuje dane graficznego edytora projektu.',
  })
  @ApiParam({ name: 'id', description: 'UUID projektu', type: String })
  @ApiResponse({
    status: 200,
    description: 'Dane edytora zapisane',
    type: ProjectResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Błędne dane wejściowe' })
  @ApiResponse({ status: 401, description: 'Brak autoryzacji' })
  @ApiResponse({ status: 404, description: 'Projekt nie znaleziony' })
  public async saveEditorData(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: EditorData,
    @GetCurrentUserId() userId: string,
  ): Promise<ProjectResponseDto> {
    const project = await this.projectsService.update(
      id,
      { editorData: JSON.stringify(data) },
      userId,
    );
    return this.mapToResponse(project);
  }

  /**
   * Map entity to response DTO
   */
  private mapToResponse(p: FormworkProjectEntity): ProjectResponseDto {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      slabLength: p.slabLength,
      slabWidth: p.slabWidth,
      slabThickness: p.slabThickness,
      floorHeight: p.floorHeight,
      slabType: p.slabType,
      formworkSystem: p.formworkSystem,
      slabArea: p.slabLength * p.slabWidth,
      calculationResult: p.calculationResult
        ? (JSON.parse(p.calculationResult) as FormworkLayout)
        : undefined,
      optimizationResult: p.optimizationResult
        ? (JSON.parse(p.optimizationResult) as OptimizationResult)
        : undefined,
      extractedPdfData: p.extractedPdfData
        ? (JSON.parse(p.extractedPdfData) as ExtractedPdfData)
        : undefined,
      extractedSlabGeometry: p.extractedSlabGeometry
        ? (JSON.parse(p.extractedSlabGeometry) as ExtractedSlabGeometry)
        : undefined,
      editorData: p.editorData
        ? (JSON.parse(p.editorData) as EditorData)
        : undefined,
      sourcePdfPath: p.sourcePdfPath,
      geoJsonPath: p.geoJsonPath,
      svgPath: p.svgPath,
      dxfPath: p.dxfPath,
      extractionStatus: p.extractionStatus,
      extractionAttempts: p.extractionAttempts,
      extractionMessage: p.extractionMessage,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }
}
