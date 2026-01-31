import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GeometryService } from './geometry.service';
import { FormworkProjectEntity } from '../inventory/entities/formwork-project.entity';
import { InkscapeConversionService } from './inkscape-conversion.service';
import * as fs from 'fs';

jest.mock('fs');

const mockFs = fs as jest.Mocked<typeof fs>;

describe('GeometryService', () => {
  let service: GeometryService;

  const mockRepository = {
    update: jest.fn(),
    findOne: jest.fn(),
  };

  const mockInkscapeService = {
    convertPdfToSvg: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeometryService,
        {
          provide: getRepositoryToken(FormworkProjectEntity),
          useValue: mockRepository,
        },
        {
          provide: InkscapeConversionService,
          useValue: mockInkscapeService,
        },
      ],
    }).compile();

    service = module.get<GeometryService>(GeometryService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('startExtraction', () => {
    it('should return a job ID and start extraction', () => {
      const result = service.startExtraction('/test/path.pdf');

      expect(result).toHaveProperty('jobId');
      expect(typeof result.jobId).toBe('string');
    });

    it('should create a job and start processing', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const { jobId } = service.startExtraction('/test/path.pdf');

      await new Promise((resolve) => setTimeout(resolve, 150));

      const job = service.getJobStatus(jobId);
      expect(job).not.toBeNull();
      expect(['pending', 'processing', 'failed']).toContain(job?.status);
    });

    it('should include projectId in extraction when provided', () => {
      const { jobId } = service.startExtraction(
        '/test/path.pdf',
        'project-123',
      );
      const job = service.getJobStatus(jobId);

      expect(job).not.toBeNull();
      expect(job?.id).toBe(jobId);
    });
  });

  describe('getJobStatus', () => {
    it('should return null for non-existent job', () => {
      const job = service.getJobStatus('non-existent-job-id');
      expect(job).toBeNull();
    });

    it('should return job for existing job ID', () => {
      const { jobId } = service.startExtraction('/test/path.pdf');
      const job = service.getJobStatus(jobId);

      expect(job).not.toBeNull();
      expect(job?.id).toBe(jobId);
    });
  });

  describe('processExtraction (integration)', () => {
    beforeEach(() => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.mkdirSync.mockReturnValue(undefined);
      mockFs.copyFileSync.mockReturnValue(undefined);
    });

    it('should fail if PDF file does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const { jobId } = service.startExtraction('/test/missing.pdf');

      await new Promise((resolve) => setTimeout(resolve, 100));

      const job = service.getJobStatus(jobId);
      expect(job?.status).toBe('failed');
      expect(job?.message).toBe('PDF file not found');
    });

    it('should handle /uploads path correctly', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const { jobId } = service.startExtraction('/uploads/test.pdf');

      await new Promise((resolve) => setTimeout(resolve, 100));

      const job = service.getJobStatus(jobId);
      expect(job?.status).toBe('failed');
    });

    it('should fail if inkscape returns no SVG', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockInkscapeService.convertPdfToSvg.mockResolvedValue([]);

      const { jobId } = service.startExtraction('/test/path.pdf', 'project-1');

      await new Promise((resolve) => setTimeout(resolve, 200));

      const job = service.getJobStatus(jobId);
      expect(job?.status).toBe('failed');
      expect(job?.message).toContain('No SVG generated');
    });
  });
});
