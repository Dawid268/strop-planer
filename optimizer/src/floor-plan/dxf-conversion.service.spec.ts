/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DxfConversionService, DxfData } from './dxf-conversion.service';
import { promises as fs } from 'fs';

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    access: jest.fn(),
  },
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('DxfConversionService', () => {
  let service: DxfConversionService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [DxfConversionService],
    }).compile();

    service = module.get<DxfConversionService>(DxfConversionService);
  });

  describe('processUploadedFile', () => {
    it('should throw BadRequestException when no file is provided', async () => {
      await expect(
        service.processUploadedFile(null as unknown as Express.Multer.File),
      ).rejects.toThrow(BadRequestException);
    });

    it('should process DXF file successfully', async () => {
      const mockFile = {
        filename: 'test-123.dxf',
        path: '/tmp/test-123.dxf',
      } as Express.Multer.File;

      const mockDxfContent = `0
SECTION
2
ENTITIES
0
ENDSEC
0
EOF`;

      mockFs.readFile.mockResolvedValue(mockDxfContent);
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await service.processUploadedFile(mockFile);

      expect(result).toHaveProperty('documentId', 'test-123');
      expect(result).toHaveProperty('data');
      expect(result.data).toHaveProperty('entities');
      expect(result.data).toHaveProperty('layers');
      expect(result.data).toHaveProperty('bounds');
    });

    it('should throw BadRequestException on processing error', async () => {
      const mockFile = {
        filename: 'test.dxf',
        path: '/tmp/test.dxf',
      } as Express.Multer.File;

      mockFs.readFile.mockRejectedValue(new Error('File read error'));

      await expect(service.processUploadedFile(mockFile)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getFloorPlanData', () => {
    it('should return floor plan data for existing document', async () => {
      const mockData: DxfData = {
        entities: [],
        layers: ['default'],
        bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockData));

      const result = await service.getFloorPlanData('doc-123');

      expect(result).toEqual(mockData);
    });

    it('should throw BadRequestException for non-existent document', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));

      await expect(service.getFloorPlanData('non-existent')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getRawDxfContent', () => {
    it('should return raw DXF content for existing file', async () => {
      const mockContent = '0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF';

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(mockContent);

      const result = await service.getRawDxfContent('doc-123');

      expect(result).toBe(mockContent);
    });

    it('should throw BadRequestException for non-existent file', async () => {
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      await expect(service.getRawDxfContent('non-existent')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('convertPdfToDxf', () => {
    it('should be defined', () => {
      expect(service.convertPdfToDxf).toBeDefined();
    });
  });

  describe('parseDxfFile', () => {
    it('should parse valid DXF file', async () => {
      const mockDxfContent = `0
SECTION
2
ENTITIES
0
ENDSEC
0
EOF`;

      mockFs.readFile.mockResolvedValue(mockDxfContent);

      const result = await service.parseDxfFile('/tmp/test.dxf');

      expect(result).toHaveProperty('entities');
      expect(result).toHaveProperty('layers');
      expect(result).toHaveProperty('bounds');
    });

    it('should throw error when file cannot be read', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      await expect(
        service.parseDxfFile('/tmp/nonexistent.dxf'),
      ).rejects.toThrow();
    });
  });
});
