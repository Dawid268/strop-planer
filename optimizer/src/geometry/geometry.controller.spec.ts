/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { GeometryController } from './geometry.controller';
import { GeometryService, Job } from './geometry.service';
import { ExtractGeometryDto } from './dto/extract-geometry.dto';

describe('GeometryController', () => {
  let controller: GeometryController;
  let geometryService: GeometryService;

  const mockJob: Job = {
    id: 'test-job-id',
    status: 'pending',
    message: 'Starting extraction...',
    createdAt: new Date(),
  };

  const mockGeometryService = {
    startExtraction: jest.fn(),
    getJobStatus: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GeometryController],
      providers: [
        {
          provide: GeometryService,
          useValue: mockGeometryService,
        },
      ],
    }).compile();

    controller = module.get<GeometryController>(GeometryController);
    geometryService = module.get<GeometryService>(GeometryService);
  });

  describe('startExtraction', () => {
    it('should start extraction and return job ID', () => {
      const dto: ExtractGeometryDto = {
        pdfPath: '/uploads/test.pdf',
        projectId: 'project-123',
      };
      mockGeometryService.startExtraction.mockReturnValue({ jobId: 'job-123' });

      const result = controller.startExtraction(dto);

      expect(result).toEqual({ jobId: 'job-123' });
      expect(geometryService.startExtraction).toHaveBeenCalledWith(
        dto.pdfPath,
        dto.projectId,
      );
    });

    it('should start extraction without projectId', () => {
      const dto: ExtractGeometryDto = {
        pdfPath: '/uploads/test.pdf',
      };
      mockGeometryService.startExtraction.mockReturnValue({ jobId: 'job-456' });

      const result = controller.startExtraction(dto);

      expect(result).toEqual({ jobId: 'job-456' });
      expect(geometryService.startExtraction).toHaveBeenCalledWith(
        dto.pdfPath,
        undefined,
      );
    });

    it('should throw BadRequestException on service error', () => {
      const dto: ExtractGeometryDto = {
        pdfPath: '/uploads/test.pdf',
      };
      mockGeometryService.startExtraction.mockImplementation(() => {
        throw new Error('Service error');
      });

      expect(() => controller.startExtraction(dto)).toThrow(
        BadRequestException,
      );
    });

    it('should handle unknown error type', () => {
      const dto: ExtractGeometryDto = {
        pdfPath: '/uploads/test.pdf',
      };
      mockGeometryService.startExtraction.mockImplementation(() => {
        throw new Error('unknown error');
      });

      expect(() => controller.startExtraction(dto)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('getStatus', () => {
    it('should return job status for existing job', () => {
      mockGeometryService.getJobStatus.mockReturnValue(mockJob);

      const result = controller.getStatus('test-job-id');

      expect(result).toEqual(mockJob);
      expect(geometryService.getJobStatus).toHaveBeenCalledWith('test-job-id');
    });

    it('should throw BadRequestException for non-existent job', () => {
      mockGeometryService.getJobStatus.mockReturnValue(null);

      expect(() => controller.getStatus('non-existent')).toThrow(
        BadRequestException,
      );
    });

    it('should return completed job with result', () => {
      const completedJob: Job = {
        ...mockJob,
        status: 'completed',
        message: 'Extraction successful',
        result: { polygons: [] },
      };
      mockGeometryService.getJobStatus.mockReturnValue(completedJob);

      const result = controller.getStatus('test-job-id');

      expect(result.status).toBe('completed');
      expect(result.result).toEqual({ polygons: [] });
    });

    it('should return failed job with error message', () => {
      const failedJob: Job = {
        ...mockJob,
        status: 'failed',
        message: 'PDF file not found',
      };
      mockGeometryService.getJobStatus.mockReturnValue(failedJob);

      const result = controller.getStatus('test-job-id');

      expect(result.status).toBe('failed');
      expect(result.message).toBe('PDF file not found');
    });
  });
});
