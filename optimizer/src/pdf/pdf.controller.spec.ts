/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PdfController } from './pdf.controller';
import { PdfService } from './pdf.service';
import { DxfConversionService } from '../floor-plan/dxf-conversion.service';
import { ProjectsService } from '../projects/projects.service';

describe('PdfController', () => {
  let controller: PdfController;
  let pdfService: PdfService;

  const mockPdfService = {
    parsePdf: jest.fn(),
    parseBatch: jest.fn(),
  };

  const mockDxfService = {
    convertPdfToDxf: jest.fn(),
    parseDxfFile: jest.fn(),
  };

  const mockProjectsService = {
    updateArtifactPaths: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PdfController],
      providers: [
        { provide: PdfService, useValue: mockPdfService },
        { provide: DxfConversionService, useValue: mockDxfService },
        { provide: ProjectsService, useValue: mockProjectsService },
      ],
    }).compile();

    controller = module.get<PdfController>(PdfController);
    pdfService = module.get<PdfService>(PdfService);
  });

  describe('getStatus', () => {
    it('should return ok status', () => {
      const result = controller.getStatus();

      expect(result).toEqual({
        status: 'ok',
        message: 'PDF Service is running',
      });
    });
  });

  describe('uploadPdf', () => {
    it('should throw BadRequestException when no file provided', async () => {
      await expect(
        controller.uploadPdf(null as unknown as Express.Multer.File),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for non-PDF file', async () => {
      const mockFile = {
        buffer: Buffer.from('content'),
        originalname: 'test.pdf',
        mimetype: 'image/png',
      } as Express.Multer.File;

      await expect(controller.uploadPdf(mockFile)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should parse PDF successfully', async () => {
      const mockFile = {
        buffer: Buffer.from('content'),
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
      } as Express.Multer.File;

      const mockResult = {
        sourceFile: '/uploads/test.pdf',
        extractedAt: new Date(),
        slab: null,
        rawText: 'test',
        warnings: [],
      };

      mockPdfService.parsePdf.mockResolvedValue(mockResult);

      const result = await controller.uploadPdf(mockFile);

      expect(result).toEqual(mockResult);
      expect(pdfService.parsePdf).toHaveBeenCalledWith(
        mockFile.buffer,
        mockFile.originalname,
      );
    });

    it('should throw InternalServerErrorException on parse error', async () => {
      const mockFile = {
        buffer: Buffer.from('content'),
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
      } as Express.Multer.File;

      mockPdfService.parsePdf.mockRejectedValue(new Error('Parse error'));

      await expect(controller.uploadPdf(mockFile)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('uploadBatch', () => {
    it('should throw BadRequestException when no files provided', async () => {
      await expect(controller.uploadBatch([])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when no PDF files in batch', async () => {
      const files = [
        {
          buffer: Buffer.from('content'),
          originalname: 'test.png',
          mimetype: 'image/png',
        },
      ] as Express.Multer.File[];

      await expect(controller.uploadBatch(files)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should process PDF batch successfully', async () => {
      const files = [
        {
          buffer: Buffer.from('content1'),
          originalname: 'strop.pdf',
          mimetype: 'application/pdf',
        },
        {
          buffer: Buffer.from('content2'),
          originalname: 'konstrukcja.pdf',
          mimetype: 'application/pdf',
        },
      ] as Express.Multer.File[];

      const mockResult = {
        files: [],
        recommendedFiles: ['strop.pdf'],
        totalFiles: 2,
        successfullyParsed: 2,
      };

      mockPdfService.parseBatch.mockResolvedValue(mockResult);

      const result = await controller.uploadBatch(files);

      expect(result).toEqual(mockResult);
      expect(pdfService.parseBatch).toHaveBeenCalled();
    });

    it('should filter non-PDF files from batch', async () => {
      const files = [
        {
          buffer: Buffer.from('content1'),
          originalname: 'test.pdf',
          mimetype: 'application/pdf',
        },
        {
          buffer: Buffer.from('content2'),
          originalname: 'test.png',
          mimetype: 'image/png',
        },
      ] as Express.Multer.File[];

      mockPdfService.parseBatch.mockResolvedValue({
        files: [],
        recommendedFiles: [],
        totalFiles: 1,
        successfullyParsed: 1,
      });

      await controller.uploadBatch(files);

      expect(pdfService.parseBatch).toHaveBeenCalledWith([
        expect.objectContaining({ filename: 'test.pdf' }),
      ]);
    });

    it('should throw InternalServerErrorException on batch error', async () => {
      const files = [
        {
          buffer: Buffer.from('content'),
          originalname: 'test.pdf',
          mimetype: 'application/pdf',
        },
      ] as Express.Multer.File[];

      mockPdfService.parseBatch.mockRejectedValue(new Error('Batch error'));

      await expect(controller.uploadBatch(files)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('uploadPdfForProject', () => {
    const mockUserId = 'user-uuid-1';

    it('should throw BadRequestException when no file provided', async () => {
      await expect(
        controller.uploadPdfForProject(
          null as unknown as Express.Multer.File,
          'project-1',
          mockUserId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should skip DB update for temp project IDs', async () => {
      const mockFile = {
        buffer: Buffer.from('content'),
        originalname: 'test.pdf',
      } as Express.Multer.File;

      mockPdfService.parsePdf.mockResolvedValue({
        sourceFile: '/uploads/test.pdf',
      });
      mockDxfService.convertPdfToDxf.mockResolvedValue(undefined);
      mockDxfService.parseDxfFile.mockResolvedValue({
        entities: [],
        layers: [],
        bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      });

      await controller.uploadPdfForProject(mockFile, 'temp_123', mockUserId);

      expect(mockProjectsService.updateArtifactPaths).not.toHaveBeenCalled();
    });
  });
});
