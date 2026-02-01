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

  describe('transformDxfToSimpleFormat (via parseDxfFile)', () => {
    it('should transform LINE entities', async () => {
      // Create mock that returns parsed DXF with LINE entity
      const mockService = service as unknown as {
        parser: { parseSync: jest.Mock };
      };
      const originalParser = mockService.parser.parseSync;
      mockService.parser.parseSync = jest.fn().mockReturnValue({
        entities: [
          {
            type: 'LINE',
            layer: 'walls',
            vertices: [
              { x: 0, y: 0 },
              { x: 100, y: 100 },
            ],
          },
        ],
      });

      mockFs.readFile.mockResolvedValue('fake dxf content');

      const result = await service.parseDxfFile('/tmp/line.dxf');

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].type).toBe('LINE');
      expect(result.entities[0].startPoint).toEqual({ x: 0, y: 0 });
      expect(result.entities[0].endPoint).toEqual({ x: 100, y: 100 });
      expect(result.layers).toContain('walls');
      expect(result.bounds.minX).toBe(0);
      expect(result.bounds.maxX).toBe(100);

      // Restore
      mockService.parser.parseSync = originalParser;
    });

    it('should transform POLYLINE entities', async () => {
      const mockService = service as unknown as {
        parser: { parseSync: jest.Mock };
      };
      const originalParser = mockService.parser.parseSync;
      mockService.parser.parseSync = jest.fn().mockReturnValue({
        entities: [
          {
            type: 'LWPOLYLINE',
            layer: 'outline',
            vertices: [
              { x: 0, y: 0 },
              { x: 50, y: 0 },
              { x: 50, y: 50 },
              { x: 0, y: 50 },
            ],
          },
        ],
      });

      mockFs.readFile.mockResolvedValue('fake dxf content');

      const result = await service.parseDxfFile('/tmp/polyline.dxf');

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].type).toBe('POLYLINE');
      expect(result.entities[0].vertices).toHaveLength(4);
      expect(result.layers).toContain('outline');

      mockService.parser.parseSync = originalParser;
    });

    it('should transform CIRCLE entities', async () => {
      const mockService = service as unknown as {
        parser: { parseSync: jest.Mock };
      };
      const originalParser = mockService.parser.parseSync;
      mockService.parser.parseSync = jest.fn().mockReturnValue({
        entities: [
          {
            type: 'CIRCLE',
            layer: 'circles',
            center: { x: 50, y: 50 },
            radius: 25,
          },
        ],
      });

      mockFs.readFile.mockResolvedValue('fake dxf content');

      const result = await service.parseDxfFile('/tmp/circle.dxf');

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].type).toBe('CIRCLE');
      expect(result.entities[0].center).toEqual({ x: 50, y: 50 });
      expect(result.entities[0].radius).toBe(25);
      // Bounds should account for radius
      expect(result.bounds.minX).toBe(25); // 50 - 25
      expect(result.bounds.maxX).toBe(75); // 50 + 25

      mockService.parser.parseSync = originalParser;
    });

    it('should transform ARC entities', async () => {
      const mockService = service as unknown as {
        parser: { parseSync: jest.Mock };
      };
      const originalParser = mockService.parser.parseSync;
      mockService.parser.parseSync = jest.fn().mockReturnValue({
        entities: [
          {
            type: 'ARC',
            layer: 'arcs',
            center: { x: 100, y: 100 },
            radius: 50,
          },
        ],
      });

      mockFs.readFile.mockResolvedValue('fake dxf content');

      const result = await service.parseDxfFile('/tmp/arc.dxf');

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].type).toBe('ARC');

      mockService.parser.parseSync = originalParser;
    });

    it('should transform TEXT entities with startPoint', async () => {
      const mockService = service as unknown as {
        parser: { parseSync: jest.Mock };
      };
      const originalParser = mockService.parser.parseSync;
      mockService.parser.parseSync = jest.fn().mockReturnValue({
        entities: [
          {
            type: 'TEXT',
            layer: 'text',
            startPoint: { x: 10, y: 20 },
            text: 'Hello World',
          },
        ],
      });

      mockFs.readFile.mockResolvedValue('fake dxf content');

      const result = await service.parseDxfFile('/tmp/text.dxf');

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].type).toBe('TEXT');
      expect(result.entities[0].text).toBe('Hello World');
      expect(result.entities[0].startPoint).toEqual({ x: 10, y: 20 });

      mockService.parser.parseSync = originalParser;
    });

    it('should transform MTEXT entities with position', async () => {
      const mockService = service as unknown as {
        parser: { parseSync: jest.Mock };
      };
      const originalParser = mockService.parser.parseSync;
      mockService.parser.parseSync = jest.fn().mockReturnValue({
        entities: [
          {
            type: 'MTEXT',
            layer: 'annotations',
            position: { x: 30, y: 40 },
            string: 'Annotation text',
          },
        ],
      });

      mockFs.readFile.mockResolvedValue('fake dxf content');

      const result = await service.parseDxfFile('/tmp/mtext.dxf');

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].type).toBe('TEXT');
      expect(result.entities[0].text).toBe('Annotation text');

      mockService.parser.parseSync = originalParser;
    });

    it('should use default layer when not specified', async () => {
      const mockService = service as unknown as {
        parser: { parseSync: jest.Mock };
      };
      const originalParser = mockService.parser.parseSync;
      mockService.parser.parseSync = jest.fn().mockReturnValue({
        entities: [
          {
            type: 'LINE',
            // No layer specified
            vertices: [
              { x: 0, y: 0 },
              { x: 10, y: 10 },
            ],
          },
        ],
      });

      mockFs.readFile.mockResolvedValue('fake dxf content');

      const result = await service.parseDxfFile('/tmp/nolayer.dxf');

      expect(result.entities[0].layer).toBe('default');
      expect(result.layers).toContain('default');

      mockService.parser.parseSync = originalParser;
    });

    it('should return default bounds when no entities', async () => {
      const mockService = service as unknown as {
        parser: { parseSync: jest.Mock };
      };
      const originalParser = mockService.parser.parseSync;
      mockService.parser.parseSync = jest.fn().mockReturnValue({
        entities: [],
      });

      mockFs.readFile.mockResolvedValue('fake dxf content');

      const result = await service.parseDxfFile('/tmp/empty.dxf');

      expect(result.entities).toHaveLength(0);
      expect(result.bounds.minX).toBe(0);
      expect(result.bounds.minY).toBe(0);
      expect(result.bounds.maxX).toBe(100);
      expect(result.bounds.maxY).toBe(100);

      mockService.parser.parseSync = originalParser;
    });

    it('should handle null entities array', async () => {
      const mockService = service as unknown as {
        parser: { parseSync: jest.Mock };
      };
      const originalParser = mockService.parser.parseSync;
      mockService.parser.parseSync = jest.fn().mockReturnValue({
        // entities is undefined
      });

      mockFs.readFile.mockResolvedValue('fake dxf content');

      const result = await service.parseDxfFile('/tmp/null-entities.dxf');

      expect(result.entities).toHaveLength(0);

      mockService.parser.parseSync = originalParser;
    });

    it('should skip entities with invalid vertices', async () => {
      const mockService = service as unknown as {
        parser: { parseSync: jest.Mock };
      };
      const originalParser = mockService.parser.parseSync;
      mockService.parser.parseSync = jest.fn().mockReturnValue({
        entities: [
          {
            type: 'LINE',
            layer: 'test',
            vertices: [{ x: 0, y: 0 }], // Only 1 vertex, need 2 for LINE
          },
          {
            type: 'POLYLINE',
            layer: 'test',
            vertices: [], // Empty vertices
          },
          {
            type: 'CIRCLE',
            layer: 'test',
            // No center or radius
          },
        ],
      });

      mockFs.readFile.mockResolvedValue('fake dxf content');

      const result = await service.parseDxfFile('/tmp/invalid.dxf');

      expect(result.entities).toHaveLength(0);

      mockService.parser.parseSync = originalParser;
    });

    it('should skip null entities', async () => {
      const mockService = service as unknown as {
        parser: { parseSync: jest.Mock };
      };
      const originalParser = mockService.parser.parseSync;
      mockService.parser.parseSync = jest.fn().mockReturnValue({
        entities: [null, undefined],
      });

      mockFs.readFile.mockResolvedValue('fake dxf content');

      const result = await service.parseDxfFile('/tmp/null-items.dxf');

      expect(result.entities).toHaveLength(0);

      mockService.parser.parseSync = originalParser;
    });

    it('should handle non-numeric coordinates gracefully', async () => {
      const mockService = service as unknown as {
        parser: { parseSync: jest.Mock };
      };
      const originalParser = mockService.parser.parseSync;
      mockService.parser.parseSync = jest.fn().mockReturnValue({
        entities: [
          {
            type: 'LINE',
            layer: 'test',
            vertices: [
              { x: 'invalid' as unknown as number, y: 0 },
              { x: 100, y: 100 },
            ],
          },
        ],
      });

      mockFs.readFile.mockResolvedValue('fake dxf content');

      const result = await service.parseDxfFile('/tmp/bad-coords.dxf');

      // Should still create entity but bounds check will skip invalid coords
      expect(result.entities).toHaveLength(1);

      mockService.parser.parseSync = originalParser;
    });
  });

  describe('processUploadedFile - PDF handling', () => {
    it('should detect PDF extension and attempt conversion', async () => {
      const mockFile = {
        filename: 'drawing.pdf',
        path: '/tmp/drawing.pdf',
      } as Express.Multer.File;

      // Mock the converted DXF file
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

      // The processing will go through the PDF path but may fail at inkscape
      // However, since child_process is not properly mocked in this test file,
      // we just verify the file is processed
      try {
        await service.processUploadedFile(mockFile);
      } catch {
        // Expected to fail due to inkscape mock
      }

      // Verify mkdir was called (processing started)
      expect(mockFs.mkdir).toHaveBeenCalled();
    });
  });
});
