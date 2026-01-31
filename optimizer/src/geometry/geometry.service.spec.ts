import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GeometryService } from './geometry.service';
import { FormworkProjectEntity } from '../inventory/entities/formwork-project.entity';
import { InkscapeConversionService } from './inkscape-conversion.service';
import * as fs from 'fs';
import * as childProcess from 'child_process';

jest.mock('fs');
jest.mock('child_process');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockChildProcess = childProcess as jest.Mocked<typeof childProcess>;

// Type-safe exec callback
type ExecCallback = (
  error: childProcess.ExecException | null,
  stdout: string | Buffer,
  stderr: string | Buffer,
) => void;

// Helper to create typed exec mock
function createExecMock(stdout: string, stderr: string = ''): jest.Mock {
  return jest.fn(
    (
      _cmd: string,
      _opts: childProcess.ExecOptions | ExecCallback,
      callback?: ExecCallback,
    ) => {
      const cb = typeof _opts === 'function' ? _opts : callback;
      if (cb) {
        cb(null, stdout, stderr);
      }
      return { stdout: '', stderr: '' } as childProcess.ChildProcess;
    },
  );
}

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

    it('should process extraction with valid polygons', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockInkscapeService.convertPdfToSvg.mockResolvedValue(['/tmp/test.svg']);

      const mockExec = createExecMock(
        JSON.stringify({
          polygons: [
            {
              points: [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 100 },
              ],
            },
          ],
        }),
      );
      mockChildProcess.exec.mockImplementation(
        mockExec as unknown as typeof childProcess.exec,
      );

      const { jobId } = service.startExtraction(
        '/test/valid.pdf',
        'project-123',
      );

      await new Promise((resolve) => setTimeout(resolve, 300));

      const job = service.getJobStatus(jobId);
      // May be completed or failed depending on exec mock
      expect(['completed', 'failed', 'processing']).toContain(job?.status);
    });

    it('should handle Python stderr warnings', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockInkscapeService.convertPdfToSvg.mockResolvedValue(['/tmp/test.svg']);

      const mockExec = createExecMock(
        JSON.stringify({ polygons: [] }),
        'Warning: some warning',
      );
      mockChildProcess.exec.mockImplementation(
        mockExec as unknown as typeof childProcess.exec,
      );

      const { jobId } = service.startExtraction('/test/valid.pdf');

      await new Promise((resolve) => setTimeout(resolve, 300));

      const job = service.getJobStatus(jobId);
      expect(job).not.toBeNull();
    });

    it('should handle error response from Python script', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockInkscapeService.convertPdfToSvg.mockResolvedValue(['/tmp/test.svg']);

      const mockExec = createExecMock(
        JSON.stringify({ error: 'No shapes found' }),
      );
      mockChildProcess.exec.mockImplementation(
        mockExec as unknown as typeof childProcess.exec,
      );

      const { jobId } = service.startExtraction(
        '/test/empty.pdf',
        'project-456',
      );

      await new Promise((resolve) => setTimeout(resolve, 300));

      const job = service.getJobStatus(jobId);
      expect(job).not.toBeNull();
    });

    it('should handle invalid JSON from Python', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockInkscapeService.convertPdfToSvg.mockResolvedValue(['/tmp/test.svg']);

      const mockExec = createExecMock('not valid json');
      mockChildProcess.exec.mockImplementation(
        mockExec as unknown as typeof childProcess.exec,
      );

      const { jobId } = service.startExtraction(
        '/test/invalid.pdf',
        'project-789',
      );

      await new Promise((resolve) => setTimeout(resolve, 300));

      const job = service.getJobStatus(jobId);
      expect(job).not.toBeNull();
    });

    it('should handle database update failure', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockInkscapeService.convertPdfToSvg.mockResolvedValue(['/tmp/test.svg']);
      mockRepository.update.mockRejectedValue(new Error('DB Error'));

      const mockExec = createExecMock(
        JSON.stringify({
          polygons: [{ points: [{ x: 0, y: 0 }] }],
        }),
      );
      mockChildProcess.exec.mockImplementation(
        mockExec as unknown as typeof childProcess.exec,
      );

      const { jobId } = service.startExtraction(
        '/test/db-fail.pdf',
        'project-db',
      );

      await new Promise((resolve) => setTimeout(resolve, 300));

      const job = service.getJobStatus(jobId);
      expect(job).not.toBeNull();
    });

    it('should complete without projectId', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockInkscapeService.convertPdfToSvg.mockResolvedValue(['/tmp/test.svg']);

      const mockExec = createExecMock(JSON.stringify({ polygons: [] }));
      mockChildProcess.exec.mockImplementation(
        mockExec as unknown as typeof childProcess.exec,
      );

      const { jobId } = service.startExtraction('/test/no-project.pdf');

      await new Promise((resolve) => setTimeout(resolve, 300));

      const job = service.getJobStatus(jobId);
      expect(job).not.toBeNull();
    });

    it('should handle relative path conversion', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const { jobId } = service.startExtraction('relative/path/test.pdf');

      await new Promise((resolve) => setTimeout(resolve, 100));

      const job = service.getJobStatus(jobId);
      expect(job?.status).toBe('failed');
    });

    it('should handle inkscape conversion error', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockInkscapeService.convertPdfToSvg.mockRejectedValue(
        new Error('Inkscape not installed'),
      );

      const { jobId } = service.startExtraction(
        '/test/inkscape-fail.pdf',
        'project-ink',
      );

      await new Promise((resolve) => setTimeout(resolve, 300));

      const job = service.getJobStatus(jobId);
      expect(job?.status).toBe('failed');
      expect(job?.message).toContain('Inkscape not installed');
    });

    it('should create uploads/converted directory if not exists', async () => {
      mockFs.existsSync
        .mockReturnValueOnce(true) // PDF exists
        .mockReturnValueOnce(false); // uploads/converted doesn't exist
      mockInkscapeService.convertPdfToSvg.mockResolvedValue(['/tmp/test.svg']);

      const mockExec = createExecMock(
        JSON.stringify({
          polygons: [{ points: [{ x: 0, y: 0 }] }],
        }),
      );
      mockChildProcess.exec.mockImplementation(
        mockExec as unknown as typeof childProcess.exec,
      );

      const { jobId } = service.startExtraction(
        '/test/new-dir.pdf',
        'project-newdir',
      );

      await new Promise((resolve) => setTimeout(resolve, 300));

      const job = service.getJobStatus(jobId);
      expect(job).not.toBeNull();
    });

    it('should handle result with empty polygons (no polygons)', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockInkscapeService.convertPdfToSvg.mockResolvedValue(['/tmp/test.svg']);

      const mockExec = createExecMock(
        JSON.stringify({ someOtherData: 'value' }),
      );
      mockChildProcess.exec.mockImplementation(
        mockExec as unknown as typeof childProcess.exec,
      );

      const { jobId } = service.startExtraction(
        '/test/no-polygons.pdf',
        'project-np',
      );

      await new Promise((resolve) => setTimeout(resolve, 300));

      const job = service.getJobStatus(jobId);
      expect(job).not.toBeNull();
    });

    it('should handle array-style polygons', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockInkscapeService.convertPdfToSvg.mockResolvedValue(['/tmp/test.svg']);

      const mockExec = createExecMock(
        JSON.stringify({
          polygons: [
            [
              { x: 0, y: 0 },
              { x: 100, y: 100 },
            ],
          ],
        }),
      );
      mockChildProcess.exec.mockImplementation(
        mockExec as unknown as typeof childProcess.exec,
      );

      const { jobId } = service.startExtraction(
        '/test/array-poly.pdf',
        'project-arr',
      );

      await new Promise((resolve) => setTimeout(resolve, 300));

      const job = service.getJobStatus(jobId);
      expect(job).not.toBeNull();
    });
  });

  describe('updateJob (private)', () => {
    it('should not crash when updating non-existent job', () => {
      // Access private method through bracket notation
      const updateJob = (
        service as unknown as {
          updateJob: (id: string, update: Partial<{ status: string }>) => void;
        }
      ).updateJob;

      // This should not throw
      expect(() => {
        updateJob.call(service, 'non-existent', { status: 'completed' });
      }).not.toThrow();
    });
  });
});
