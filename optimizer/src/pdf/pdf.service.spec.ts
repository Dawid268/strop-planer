import { Test, TestingModule } from '@nestjs/testing';
import { PdfService, RecognizedFile } from './pdf.service';
import * as fs from 'fs';

jest.mock('fs');
jest.mock('pdf-parse', () => {
  return jest.fn().mockResolvedValue({
    numpages: 1,
    numrender: 1,
    info: {},
    metadata: {},
    text: 'Sample PDF text with strop dimensions 500x400',
    version: '1.0',
  });
});

const mockFs = fs as jest.Mocked<typeof fs>;

describe('PdfService', () => {
  let service: PdfService;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockFs.existsSync.mockReturnValue(true);
    mockFs.mkdirSync.mockReturnValue(undefined);
    mockFs.writeFileSync.mockReturnValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [PdfService],
    }).compile();

    service = module.get<PdfService>(PdfService);
  });

  describe('parsePdf', () => {
    it('should parse PDF buffer and return extracted data', async () => {
      const buffer = Buffer.from('fake pdf content');
      const filename = 'test-strop.pdf';

      const result = await service.parsePdf(buffer, filename);

      expect(result).toHaveProperty('sourceFile');
      expect(result).toHaveProperty('extractedAt');
      expect(result).toHaveProperty('rawText');
      expect(result.sourceFile).toContain('/uploads/');
    });

    it('should create uploads directory if not exists', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const buffer = Buffer.from('fake pdf content');
      await service.parsePdf(buffer, 'test.pdf');

      expect(mockFs.mkdirSync).toHaveBeenCalled();
    });

    it('should save file with unique filename', async () => {
      const buffer = Buffer.from('fake pdf content');
      await service.parsePdf(buffer, 'test file.pdf');

      expect(mockFs.writeFileSync).toHaveBeenCalled();
      const callArgs = mockFs.writeFileSync.mock.calls[0];
      expect(callArgs[0]).toContain('test_file.pdf');
    });
  });

  describe('recognizeDrawingType', () => {
    it('should recognize slab drawing from filename', () => {
      const result = service.recognizeDrawingType(
        'K01_strop_nad_parterem.pdf',
        '',
      );

      expect(result.type).toBe('slab');
      expect(result.confidence).toBeGreaterThanOrEqual(90);
    });

    it('should recognize structure drawing from filename', () => {
      const result = service.recognizeDrawingType('K02_konstrukcja.pdf', '');

      expect(result.type).toBe('structure');
      expect(result.confidence).toBeGreaterThanOrEqual(85);
    });

    it('should recognize reinforcement drawing from filename', () => {
      const result = service.recognizeDrawingType('zbrojenie_plyta.pdf', '');

      expect(result.type).toBe('reinforcement');
      expect(result.confidence).toBeGreaterThanOrEqual(85);
    });

    it('should recognize roof drawing from filename', () => {
      const result = service.recognizeDrawingType('wiezba_dachowa.pdf', '');

      expect(result.type).toBe('roof');
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });

    it('should recognize foundation drawing from filename', () => {
      const result = service.recognizeDrawingType('fundamenty.pdf', '');

      expect(result.type).toBe('foundation');
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });

    it('should recognize architecture drawing from filename', () => {
      const result = service.recognizeDrawingType('rzut_parteru.pdf', '');

      expect(result.type).toBe('architecture');
      expect(result.confidence).toBeGreaterThanOrEqual(75);
    });

    it('should recognize slab from content when filename is generic', () => {
      const result = service.recognizeDrawingType(
        'drawing.pdf',
        'Projekt stropu nad parterem',
      );

      expect(result.type).toBe('slab');
      expect(result.confidence).toBeLessThan(90);
    });

    it('should recognize structure from content', () => {
      const result = service.recognizeDrawingType(
        'drawing.pdf',
        'belka żelbetowa B1 25x40',
      );

      expect(result.type).toBe('structure');
    });

    it('should recognize reinforcement from content', () => {
      const result = service.recognizeDrawingType(
        'drawing.pdf',
        'zbrojenie dolne ∅12 co 15cm',
      );

      expect(result.type).toBe('reinforcement');
    });

    it('should return other for unknown drawings', () => {
      const result = service.recognizeDrawingType(
        'unknown.pdf',
        'random text without any keywords',
      );

      expect(result.type).toBe('other');
      expect(result.confidence).toBeLessThan(50);
    });
  });

  describe('parseBatch', () => {
    it('should process multiple files', async () => {
      const files = [
        { buffer: Buffer.from('content1'), filename: 'strop.pdf' },
        { buffer: Buffer.from('content2'), filename: 'architektura.pdf' },
      ];

      const result = await service.parseBatch(files);

      expect(result.totalFiles).toBe(2);
      expect(result.files).toHaveLength(2);
    });

    it('should identify recommended files', async () => {
      const files = [
        { buffer: Buffer.from('content1'), filename: 'strop.pdf' },
        { buffer: Buffer.from('content2'), filename: 'architektura.pdf' },
      ];

      const result = await service.parseBatch(files);

      expect(result.recommendedFiles).toContain('strop.pdf');
    });

    it('should sort results with recommended files first', async () => {
      const files = [
        { buffer: Buffer.from('content1'), filename: 'other.pdf' },
        { buffer: Buffer.from('content2'), filename: 'strop.pdf' },
      ];

      const result = await service.parseBatch(files);

      expect(result.files[0].fileName).toBe('strop.pdf');
    });

    it('should handle parsing errors gracefully', async () => {
      jest.doMock('pdf-parse', () => {
        return jest.fn().mockRejectedValueOnce(new Error('Parse error'));
      });

      const files = [
        { buffer: Buffer.from('invalid'), filename: 'broken.pdf' },
      ];

      const result = await service.parseBatch(files);

      expect(result.totalFiles).toBe(1);
    });
  });

  describe('aggregateExtractedData', () => {
    it('should return warning when no recommended files', () => {
      const files: RecognizedFile[] = [
        {
          fileName: 'other.pdf',
          drawingType: 'other',
          confidence: 30,
          isRecommended: false,
          extractedData: null,
        },
      ];

      const result = service.aggregateExtractedData(files);

      expect(result.warnings).toContain('Nie znaleziono odpowiednich rysunków');
    });

    it('should combine data from multiple recommended files', () => {
      const files: RecognizedFile[] = [
        {
          fileName: 'strop.pdf',
          drawingType: 'slab',
          confidence: 95,
          isRecommended: true,
          extractedData: {
            sourceFile: 'strop.pdf',
            extractedAt: new Date(),
            slab: {
              id: 'STROP_1',
              dimensions: { length: 1000, width: 800, thickness: 20 },
              type: 'monolithic',
              beams: [],
              reinforcement: [],
              axes: [],
            },
            rawText: 'strop text',
            warnings: [],
          },
        },
        {
          fileName: 'zbrojenie.pdf',
          drawingType: 'reinforcement',
          confidence: 90,
          isRecommended: true,
          extractedData: {
            sourceFile: 'zbrojenie.pdf',
            extractedAt: new Date(),
            slab: {
              id: 'STROP_1',
              dimensions: { length: 1000, width: 800, thickness: 20 },
              type: 'monolithic',
              beams: [],
              reinforcement: [
                {
                  id: 'R1',
                  diameter: 12,
                  spacing: 15,
                  direction: 'x',
                  position: 'bottom',
                  type: 'main',
                },
              ],
              axes: [],
            },
            rawText: 'zbrojenie text',
            warnings: [],
          },
        },
      ];

      const result = service.aggregateExtractedData(files);

      expect(result.slab).not.toBeNull();
      expect(result.slab?.reinforcement).toHaveLength(1);
    });
  });
});
