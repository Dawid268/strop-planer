/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { FormworkService } from '../formwork/formwork.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import { FormworkProjectEntity } from '../inventory/entities/formwork-project.entity';
import { EditorData } from './interfaces/project.interface';

describe('ProjectsController', () => {
  let controller: ProjectsController;
  let projectsService: ProjectsService;

  const mockUserId = 'user-123';
  const mockProjectId = 'project-123';

  const mockProject: Partial<FormworkProjectEntity> = {
    id: mockProjectId,
    name: 'Test Project',
    description: 'Test description',
    status: 'draft',
    slabLength: 10,
    slabWidth: 8,
    slabThickness: 0.25,
    floorHeight: 3,
    slabType: 'monolityczny',
    formworkSystem: 'PERI_SKYDECK',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProjectsService = {
    findAll: jest.fn().mockResolvedValue([mockProject]),
    findAllPaginated: jest
      .fn()
      .mockResolvedValue({ data: [mockProject], total: 1 }),
    findOne: jest.fn().mockResolvedValue(mockProject),
    create: jest.fn().mockResolvedValue(mockProject),
    update: jest.fn().mockResolvedValue(mockProject),
    delete: jest.fn().mockResolvedValue(undefined),
    getStats: jest.fn().mockResolvedValue({ total: 5, completed: 2 }),
    saveCalculationResult: jest.fn().mockResolvedValue(mockProject),
    saveOptimizationResult: jest.fn().mockResolvedValue(mockProject),
  };

  const mockFormworkService = {
    calculateFormwork: jest.fn().mockResolvedValue({
      id: 'layout-123',
      elements: [],
      slabArea: 80,
    }),
    optimize: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        {
          provide: ProjectsService,
          useValue: mockProjectsService,
        },
        {
          provide: FormworkService,
          useValue: mockFormworkService,
        },
      ],
    }).compile();

    controller = module.get<ProjectsController>(ProjectsController);
    projectsService = module.get<ProjectsService>(ProjectsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getProjects', () => {
    it('should return paginated list of projects', async () => {
      const pagination = { page: 1, limit: 20 };

      const result = await controller.getProjects(mockUserId, pagination);

      expect(projectsService.findAllPaginated).toHaveBeenCalledWith(
        mockUserId,
        1,
        20,
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(mockProjectId);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return project statistics', async () => {
      const result = await controller.getStats(mockUserId);

      expect(projectsService.getStats).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual({ total: 5, completed: 2 });
    });
  });

  describe('getProjectById', () => {
    it('should return project by id', async () => {
      const result = await controller.getProjectById(mockProjectId, mockUserId);

      expect(projectsService.findOne).toHaveBeenCalledWith(
        mockProjectId,
        mockUserId,
      );
      expect(result.id).toBe(mockProjectId);
    });
  });

  describe('createProject', () => {
    it('should create a new project', async () => {
      const dto: CreateProjectDto = {
        name: 'New Project',
        slabLength: 12,
        slabWidth: 10,
        slabThickness: 0.3,
        floorHeight: 3.5,
      };

      const result = await controller.createProject(dto, mockUserId);

      expect(projectsService.create).toHaveBeenCalledWith(dto, mockUserId);
      expect(result.id).toBe(mockProjectId);
    });
  });

  describe('updateProject', () => {
    it('should update project', async () => {
      const dto: UpdateProjectDto = {
        name: 'Updated Project',
        status: 'calculated',
      };

      const result = await controller.updateProject(
        mockProjectId,
        dto,
        mockUserId,
      );

      expect(projectsService.update).toHaveBeenCalledWith(
        mockProjectId,
        dto,
        mockUserId,
      );
      expect(result.id).toBe(mockProjectId);
    });
  });

  describe('deleteProject', () => {
    it('should delete project', async () => {
      const result = await controller.deleteProject(mockProjectId, mockUserId);

      expect(projectsService.delete).toHaveBeenCalledWith(
        mockProjectId,
        mockUserId,
      );
      expect(result.message).toContain(mockProjectId);
    });
  });

  describe('triggerCalculation', () => {
    it('should return project after triggering calculation', async () => {
      const result = await controller.triggerCalculation(
        mockProjectId,
        mockUserId,
      );

      expect(projectsService.findOne).toHaveBeenCalledWith(
        mockProjectId,
        mockUserId,
      );
      expect(result.id).toBe(mockProjectId);
    });
  });

  describe('saveCalculation', () => {
    it('should save calculation result', async () => {
      const calculationResult = { panels: [], props: [] };

      await controller.saveCalculation(
        mockProjectId,
        calculationResult,
        mockUserId,
      );

      expect(projectsService.saveCalculationResult).toHaveBeenCalledWith(
        mockProjectId,
        mockUserId,
        JSON.stringify(calculationResult),
      );
    });
  });

  describe('saveOptimization', () => {
    it('should save optimization result', async () => {
      const optimizationResult = { savings: 10, recommendations: [] };

      await controller.saveOptimization(
        mockProjectId,
        optimizationResult,
        mockUserId,
      );

      expect(projectsService.saveOptimizationResult).toHaveBeenCalledWith(
        mockProjectId,
        mockUserId,
        JSON.stringify(optimizationResult),
      );
    });
  });

  describe('getEditorData', () => {
    it('should return editor data', async () => {
      const projectWithEditorData = {
        ...mockProject,
        editorData: JSON.stringify({ tabs: [{ id: '1', layers: [] }] }),
      };
      mockProjectsService.findOne.mockResolvedValueOnce(projectWithEditorData);

      const result = await controller.getEditorData(mockProjectId, mockUserId);

      expect(result).toEqual({ tabs: [{ id: '1', layers: [] }] });
    });

    it('should return null if no editor data', async () => {
      mockProjectsService.findOne.mockResolvedValueOnce(mockProject);

      const result = await controller.getEditorData(mockProjectId, mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('saveEditorData', () => {
    it('should save editor data', async () => {
      const editorData: EditorData = {
        tabs: [{ id: '1', name: 'Tab 1', active: true, layers: [] }],
      };

      await controller.saveEditorData(mockProjectId, editorData, mockUserId);

      expect(projectsService.update).toHaveBeenCalledWith(
        mockProjectId,
        { editorData: JSON.stringify(editorData) },
        mockUserId,
      );
    });
  });
});
