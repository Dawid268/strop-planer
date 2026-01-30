import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProjectsService } from '@/projects/projects.service';
import { AtGuard } from '@/auth/auth.guard';
import {
  CreateProjectDto,
  UpdateProjectDto,
  ProjectResponseDto,
} from './dto/project.dto';
import { GetCurrentUserId } from '@/common/decorators';
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
  public constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista wszystkich projektów użytkownika' })
  @ApiResponse({ status: 200, type: [ProjectResponseDto] })
  public async getProjects(
    @GetCurrentUserId() userId: string,
  ): Promise<ProjectResponseDto[]> {
    const projects = await this.projectsService.findAll(userId);
    return projects.map((p) => this.mapToResponse(p));
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
  @ApiOperation({ summary: 'Uruchom obliczenia dla projektu' })
  public async triggerCalculation(
    @Param('id') id: string,
    @GetCurrentUserId() userId: string,
  ): Promise<ProjectResponseDto> {
    const project = await this.projectsService.findOne(id, userId);
    return this.mapToResponse(project);
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
