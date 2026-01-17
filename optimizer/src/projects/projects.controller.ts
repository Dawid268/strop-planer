import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import {
  CreateProjectDto,
  UpdateProjectDto,
  ProjectResponseDto,
} from './dto/project.dto';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  public constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista wszystkich projektów użytkownika' })
  @ApiResponse({ status: 200, type: [ProjectResponseDto] })
  public async findAll(@Request() req: any) {
    const projects = await this.projectsService.findAll(req.user.userId);
    return projects.map((p) => ({
      ...p,
      slabArea: p.slabLength * p.slabWidth,
    }));
  }

  @Get('stats')
  @ApiOperation({ summary: 'Statystyki projektów użytkownika' })
  public async getStats(@Request() req: any) {
    return this.projectsService.getStats(req.user.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Pobierz projekt po ID' })
  @ApiResponse({ status: 200, type: ProjectResponseDto })
  public async findOne(@Param('id') id: string, @Request() req: any) {
    const project = await this.projectsService.findOne(id, req.user.userId);
    return {
      ...project,
      slabArea: project.slabLength * project.slabWidth,
      calculationResult: project.calculationResult
        ? JSON.parse(project.calculationResult)
        : null,
      optimizationResult: project.optimizationResult
        ? JSON.parse(project.optimizationResult)
        : null,
      extractedPdfData: project.extractedPdfData
        ? JSON.parse(project.extractedPdfData)
        : null,
    };
  }

  // @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Utwórz nowy projekt' })
  @ApiResponse({ status: 201, type: ProjectResponseDto })
  public async create(@Body() dto: CreateProjectDto, @Request() req: any) {
    const project = await this.projectsService.create(dto, req.user.userId);
    return {
      ...project,
      slabArea: project.slabLength * project.slabWidth,
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Aktualizuj projekt' })
  @ApiResponse({ status: 200, type: ProjectResponseDto })
  public async update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @Request() req: any,
  ) {
    const project = await this.projectsService.update(id, dto, req.user.userId);
    return {
      ...project,
      slabArea: project.slabLength * project.slabWidth,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Usuń projekt' })
  public async delete(@Param('id') id: string, @Request() req: any) {
    await this.projectsService.delete(id, req.user.userId);
    return { message: `Projekt ${id} usunięty` };
  }

  @Post(':id/calculation')
  @ApiOperation({ summary: 'Zapisz wynik obliczeń szalunku' })
  public async saveCalculation(
    @Param('id') id: string,
    @Body('result') result: any,
    @Request() req: any,
  ) {
    return this.projectsService.saveCalculationResult(
      id,
      req.user.userId,
      JSON.stringify(result),
    );
  }

  @Post(':id/optimization')
  @ApiOperation({ summary: 'Zapisz wynik optymalizacji' })
  public async saveOptimization(
    @Param('id') id: string,
    @Body('result') result: any,
    @Request() req: any,
  ) {
    return this.projectsService.saveOptimizationResult(
      id,
      req.user.userId,
      JSON.stringify(result),
    );
  }
}
