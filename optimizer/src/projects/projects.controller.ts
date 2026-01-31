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
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ProjectsService } from '@/projects/projects.service';
import { FormworkService } from '@/formwork/formwork.service';
import { AtGuard } from '@/auth/auth.guard';
import {
  CreateProjectDto,
  UpdateProjectDto,
  ProjectResponseDto,
} from './dto/project.dto';
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
} from './interfaces/project.interface';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(AtGuard)
@Controller('projects')
export class ProjectsController {
  public constructor(
    private readonly projectsService: ProjectsService,
    private readonly formworkService: FormworkService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Lista wszystkich projektów użytkownika (z paginacją)',
  })
  @ApiResponse({ status: 200, type: [ProjectResponseDto] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
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

  @Get('stats')
  @ApiOperation({ summary: 'Statystyki projektów użytkownika' })
  public async getStats(@GetCurrentUserId() userId: string) {
    return this.projectsService.getStats(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Pobierz projekt po ID' })
  @ApiResponse({ status: 200, type: ProjectResponseDto })
  public async getProjectById(
    @Param('id') id: string,
    @GetCurrentUserId() userId: string,
  ): Promise<ProjectResponseDto> {
    const project = await this.projectsService.findOne(id, userId);
    return this.mapToResponse(project);
  }

  @Post()
  @ApiOperation({ summary: 'Utwórz nowy projekt' })
  @ApiResponse({ status: 201, type: ProjectResponseDto })
  public async createProject(
    @Body() dto: CreateProjectDto,
    @GetCurrentUserId() userId: string,
  ): Promise<ProjectResponseDto> {
    const project = await this.projectsService.create(dto, userId);
    return this.mapToResponse(project);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Aktualizuj projekt' })
  @ApiResponse({ status: 200, type: ProjectResponseDto })
  public async updateProject(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @GetCurrentUserId() userId: string,
  ): Promise<ProjectResponseDto> {
    const project = await this.projectsService.update(id, dto, userId);
    return this.mapToResponse(project);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Usuń projekt' })
  public async deleteProject(
    @Param('id') id: string,
    @GetCurrentUserId() userId: string,
  ): Promise<{ message: string }> {
    await this.projectsService.delete(id, userId);
    return { message: `Projekt ${id} usunięty` };
  }

  @Post(':id/calculate')
  @ApiOperation({ summary: 'Uruchom obliczenia szalunku dla projektu' })
  @ApiResponse({ status: 200, type: ProjectResponseDto })
  public async triggerCalculation(
    @Param('id') id: string,
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
      geoJsonPath: p.geoJsonPath,
      svgPath: p.svgPath,
      dxfPath: p.dxfPath,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  }

  @Post(':id/calculation')
  @ApiOperation({ summary: 'Zapisz wynik obliczeń szalunku' })
  public async saveCalculation(
    @Param('id') id: string,
    @Body('result') result: unknown,
    @GetCurrentUserId() userId: string,
  ) {
    return this.projectsService.saveCalculationResult(
      id,
      userId,
      JSON.stringify(result),
    );
  }

  @Post(':id/optimization')
  @ApiOperation({ summary: 'Zapisz wynik optymalizacji' })
  public async saveOptimization(
    @Param('id') id: string,
    @Body('result') result: unknown,
    @GetCurrentUserId() userId: string,
  ) {
    return this.projectsService.saveOptimizationResult(
      id,
      userId,
      JSON.stringify(result),
    );
  }

  @Get(':id/editor-data')
  @ApiOperation({ summary: 'Pobierz dane edytora (karty, warstwy)' })
  public async getEditorData(
    @Param('id') id: string,
    @GetCurrentUserId() userId: string,
  ): Promise<EditorData | null> {
    const project = await this.projectsService.findOne(id, userId);
    return project.editorData
      ? (JSON.parse(project.editorData) as EditorData)
      : null;
  }

  @Put(':id/editor-data')
  @ApiOperation({ summary: 'Zapisz dane edytora (karty, warstwy)' })
  public async saveEditorData(
    @Param('id') id: string,
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
}
