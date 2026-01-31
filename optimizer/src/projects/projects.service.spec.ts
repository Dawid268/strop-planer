import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { FormworkProjectEntity } from '../inventory/entities/formwork-project.entity';
import { Repository } from 'typeorm';

/**
 * Black-box tests for ProjectsService
 * Testing based on method signatures and expected behavior only
 */
describe('ProjectsService', () => {
  let service: ProjectsService;
  let mockRepository: Record<
    keyof Repository<FormworkProjectEntity>,
    jest.Mock
  >;

  const mockUserId = 'user-123';
  const mockProjectId = 'project-456';

  const mockProject: Partial<FormworkProjectEntity> = {
    id: mockProjectId,
    name: 'Test Project',
    description: 'Test description',
    status: 'draft',
    slabLength: 10,
    slabWidth: 8,
    slabThickness: 0.25,
    floorHeight: 3.0,
    slabType: 'monolityczny',
    userId: mockUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    mockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: getRepositoryToken(FormworkProjectEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  describe('findAll(userId: string): Promise<FormworkProjectEntity[]>', () => {
    it('should return array of projects for given userId', async () => {
      // Arrange
      const expectedProjects = [
        mockProject,
        { ...mockProject, id: 'project-789' },
      ];
      mockRepository.find.mockResolvedValue(expectedProjects);

      // Act
      const result = await service.findAll(mockUserId);

      // Assert
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBe(2);
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
    });

    it('should return empty array when no projects exist', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.findAll(mockUserId);

      expect(result).toEqual([]);
    });
  });

  describe('findOne(id: string, userId: string): Promise<FormworkProjectEntity>', () => {
    it('should return project when found', async () => {
      mockRepository.findOne.mockResolvedValue(mockProject);

      const result = await service.findOne(mockProjectId, mockUserId);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockProjectId);
      expect(result.name).toBe('Test Project');
    });

    it('should throw NotFoundException when project not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent', mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create(dto: CreateProjectDto, userId: string): Promise<FormworkProjectEntity>', () => {
    it('should create and return new project', async () => {
      const createDto = {
        name: 'New Project',
        slabLength: 12,
        slabWidth: 10,
        slabThickness: 0.3,
        floorHeight: 3.5,
      };
      const createdProject = { ...mockProject, ...createDto };
      mockRepository.create.mockReturnValue(createdProject);
      mockRepository.save.mockResolvedValue(createdProject);

      const result = await service.create(createDto, mockUserId);

      expect(result).toBeDefined();
      expect(result.name).toBe('New Project');
      expect(result.slabLength).toBe(12);
    });

    it('should set default status to draft', async () => {
      const createDto = {
        name: 'Project',
        slabLength: 10,
        slabWidth: 8,
        slabThickness: 0.25,
        floorHeight: 3,
      };
      const createdProject = { ...createDto, status: 'draft' };
      mockRepository.create.mockReturnValue(createdProject);
      mockRepository.save.mockResolvedValue(createdProject);

      const result = await service.create(createDto, mockUserId);

      expect(result.status).toBe('draft');
    });
  });

  describe('update(id: string, dto: UpdateProjectDto, userId: string): Promise<FormworkProjectEntity>', () => {
    it('should update and return modified project', async () => {
      const updateDto = { name: 'Updated Name' };
      const updatedProject = { ...mockProject, name: 'Updated Name' };
      mockRepository.findOne.mockResolvedValue(mockProject);
      mockRepository.save.mockResolvedValue(updatedProject);

      const result = await service.update(mockProjectId, updateDto, mockUserId);

      expect(result.name).toBe('Updated Name');
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { name: 'X' }, mockUserId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete(id: string, userId: string): Promise<void>', () => {
    it('should delete project without error', async () => {
      mockRepository.findOne.mockResolvedValue(mockProject);
      mockRepository.remove.mockResolvedValue(undefined);

      await expect(
        service.delete(mockProjectId, mockUserId),
      ).resolves.toBeUndefined();
    });

    it('should throw NotFoundException when project does not exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.delete('non-existent', mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getStats(userId: string): Promise<{ totalProjects, draftCount, completedCount, totalArea }>', () => {
    it('should return correct statistics object', async () => {
      const projects = [
        { ...mockProject, status: 'draft', slabLength: 10, slabWidth: 8 },
        {
          ...mockProject,
          id: '2',
          status: 'completed',
          slabLength: 12,
          slabWidth: 10,
        },
      ];
      mockRepository.find.mockResolvedValue(projects);

      const result = await service.getStats(mockUserId);

      expect(result).toHaveProperty('totalProjects');
      expect(result).toHaveProperty('draftCount');
      expect(result).toHaveProperty('completedCount');
      expect(result).toHaveProperty('totalArea');
      expect(result.totalProjects).toBe(2);
      expect(result.draftCount).toBe(1);
      expect(result.completedCount).toBe(1);
      expect(result.totalArea).toBe(80 + 120); // 10*8 + 12*10
    });

    it('should return zeros when no projects exist', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.getStats(mockUserId);

      expect(result.totalProjects).toBe(0);
      expect(result.totalArea).toBe(0);
    });
  });

  describe('saveCalculationResult(id, userId, result): Promise<FormworkProjectEntity>', () => {
    it('should save calculation and update status to calculated', async () => {
      const savedProject = {
        ...mockProject,
        calculationResult: '{}',
        status: 'calculated',
      };
      mockRepository.findOne.mockResolvedValue(mockProject);
      mockRepository.save.mockResolvedValue(savedProject);

      const result = await service.saveCalculationResult(
        mockProjectId,
        mockUserId,
        '{}',
      );

      expect(result.status).toBe('calculated');
      expect(result.calculationResult).toBeDefined();
    });
  });

  describe('saveOptimizationResult(id, userId, result): Promise<FormworkProjectEntity>', () => {
    it('should save optimization and update status to optimized', async () => {
      const savedProject = {
        ...mockProject,
        optimizationResult: '{}',
        status: 'optimized',
      };
      mockRepository.findOne.mockResolvedValue(mockProject);
      mockRepository.save.mockResolvedValue(savedProject);

      const result = await service.saveOptimizationResult(
        mockProjectId,
        mockUserId,
        '{}',
      );

      expect(result.status).toBe('optimized');
      expect(result.optimizationResult).toBeDefined();
    });
  });

  describe('Editor Data Management', () => {
    it('should return null editorData if not set', async () => {
      mockRepository.findOne.mockResolvedValue(mockProject);
      const result = await service.findOne(mockProjectId, mockUserId);
      expect(result.editorData).toBeUndefined();
    });

    it('should save editor data as JSON string', async () => {
      const editorData = { tabs: [{ id: '1', layers: [] }] };
      mockRepository.findOne.mockResolvedValue(mockProject);
      mockRepository.save.mockImplementation((p) => Promise.resolve(p));

      await service.update(
        mockProjectId,
        { editorData: JSON.stringify(editorData) },
        mockUserId,
      );

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          editorData: JSON.stringify(editorData),
        }),
      );
    });
  });

  describe('findAllPaginated(userId, page, limit): Promise<{ data, total }>', () => {
    it('should return paginated projects with total count', async () => {
      const projects = [mockProject, { ...mockProject, id: 'project-789' }];
      mockRepository.findAndCount.mockResolvedValue([projects, 10]);

      const result = await service.findAllPaginated(mockUserId, 1, 20);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(10);
    });

    it('should apply pagination parameters correctly', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findAllPaginated(mockUserId, 2, 5);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        order: { updatedAt: 'DESC' },
        skip: 5,
        take: 5,
      });
    });

    it('should use default pagination values', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findAllPaginated(mockUserId);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        order: { updatedAt: 'DESC' },
        skip: 0,
        take: 20,
      });
    });
  });

  describe('attachPdfData(id, userId, pdfData): Promise<FormworkProjectEntity>', () => {
    it('should attach PDF data to project', async () => {
      const pdfData = 'extracted pdf content';
      const updatedProject = { ...mockProject, extractedPdfData: pdfData };
      mockRepository.findOne.mockResolvedValue(mockProject);
      mockRepository.save.mockResolvedValue(updatedProject);

      const result = await service.attachPdfData(
        mockProjectId,
        mockUserId,
        pdfData,
      );

      expect(result.extractedPdfData).toBe(pdfData);
    });

    it('should throw NotFoundException when project not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.attachPdfData('non-existent', mockUserId, 'data'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateArtifactPaths(id, paths, userId?): Promise<FormworkProjectEntity>', () => {
    it('should update artifact paths', async () => {
      const paths = {
        sourcePdfPath: '/uploads/test.pdf',
        svgPath: '/uploads/test.svg',
      };
      const updatedProject = { ...mockProject, ...paths };
      mockRepository.findOne.mockResolvedValue({ ...mockProject });
      mockRepository.save.mockResolvedValue(updatedProject);

      const result = await service.updateArtifactPaths(mockProjectId, paths);

      expect(result.sourcePdfPath).toBe(paths.sourcePdfPath);
      expect(result.svgPath).toBe(paths.svgPath);
    });

    it('should include userId in where clause when provided', async () => {
      mockRepository.findOne.mockResolvedValue(mockProject);
      mockRepository.save.mockResolvedValue(mockProject);

      await service.updateArtifactPaths(
        mockProjectId,
        { dxfPath: '/test.dxf' },
        mockUserId,
      );

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockProjectId, userId: mockUserId },
      });
    });

    it('should not include userId when not provided', async () => {
      mockRepository.findOne.mockResolvedValue(mockProject);
      mockRepository.save.mockResolvedValue(mockProject);

      await service.updateArtifactPaths(mockProjectId, {
        dxfPath: '/test.dxf',
      });

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockProjectId },
      });
    });

    it('should throw NotFoundException when project not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateArtifactPaths('non-existent', { svgPath: '/test.svg' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update only provided paths', async () => {
      const existingProject = {
        ...mockProject,
        sourcePdfPath: '/existing.pdf',
        dxfPath: '/existing.dxf',
      };
      mockRepository.findOne.mockResolvedValue({ ...existingProject });
      mockRepository.save.mockImplementation((p) => Promise.resolve(p));

      await service.updateArtifactPaths(mockProjectId, { svgPath: '/new.svg' });

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          sourcePdfPath: '/existing.pdf',
          dxfPath: '/existing.dxf',
          svgPath: '/new.svg',
        }),
      );
    });
  });
});
