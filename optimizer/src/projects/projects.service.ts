import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FormworkProjectEntity } from '../inventory/entities/formwork-project.entity';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

@Injectable()
export class ProjectsService {
  public constructor(
    @InjectRepository(FormworkProjectEntity)
    private readonly projectsRepository: Repository<FormworkProjectEntity>,
  ) {}

  public async findAll(userId: string): Promise<FormworkProjectEntity[]> {
    return this.projectsRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  public async findOne(
    id: string,
    userId: string,
  ): Promise<FormworkProjectEntity> {
    const project = await this.projectsRepository.findOne({
      where: { id, userId },
    });
    if (!project) {
      throw new NotFoundException(`Projekt ${id} nie znaleziony`);
    }
    return project;
  }

  public async create(
    dto: CreateProjectDto,
    userId: string,
  ): Promise<FormworkProjectEntity> {
    const project = this.projectsRepository.create({
      ...dto,
      userId,
      status: 'draft',
      slabType: dto.slabType || 'monolityczny',
    });
    return this.projectsRepository.save(project);
  }

  public async update(
    id: string,
    dto: UpdateProjectDto,
    userId: string,
  ): Promise<FormworkProjectEntity> {
    const project = await this.findOne(id, userId);
    Object.assign(project, dto);
    return this.projectsRepository.save(project);
  }

  public async delete(id: string, userId: string): Promise<void> {
    const project = await this.findOne(id, userId);
    await this.projectsRepository.remove(project);
  }

  public async attachPdfData(
    id: string,
    userId: string,
    pdfData: string,
  ): Promise<FormworkProjectEntity> {
    const project = await this.findOne(id, userId);
    project.extractedPdfData = pdfData;
    return this.projectsRepository.save(project);
  }

  public async saveCalculationResult(
    id: string,
    userId: string,
    result: string,
  ): Promise<FormworkProjectEntity> {
    const project = await this.findOne(id, userId);
    project.calculationResult = result;
    project.status = 'calculated';
    return this.projectsRepository.save(project);
  }

  public async saveOptimizationResult(
    id: string,
    userId: string,
    result: string,
  ): Promise<FormworkProjectEntity> {
    const project = await this.findOne(id, userId);
    project.optimizationResult = result;
    project.status = 'optimized';
    return this.projectsRepository.save(project);
  }

  public async getStats(userId: string): Promise<{
    totalProjects: number;
    draftCount: number;
    completedCount: number;
    totalArea: number;
  }> {
    const projects = await this.projectsRepository.find({ where: { userId } });
    return {
      totalProjects: projects.length,
      draftCount: projects.filter((p) => p.status === 'draft').length,
      completedCount: projects.filter((p) => p.status === 'completed').length,
      totalArea: projects.reduce(
        (sum, p) => sum + p.slabLength * p.slabWidth,
        0,
      ),
    };
  }

  public async updateArtifactPaths(
    id: string,
    paths: {
      sourcePdfPath?: string;
      dxfPath?: string;
      geoJsonPath?: string;
      svgPath?: string;
    },
  ): Promise<FormworkProjectEntity> {
    const project = await this.projectsRepository.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Projekt ${id} nie znaleziony`);
    }

    if (paths.sourcePdfPath) project.sourcePdfPath = paths.sourcePdfPath;
    if (paths.dxfPath) project.dxfPath = paths.dxfPath;
    if (paths.geoJsonPath) project.geoJsonPath = paths.geoJsonPath;
    if (paths.svgPath) project.svgPath = paths.svgPath;

    return this.projectsRepository.save(project);
  }
}
