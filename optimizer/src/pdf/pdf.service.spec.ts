import { Test, TestingModule } from '@nestjs/testing';
import { PdfService, RecognizedFile } from './pdf.service';
import * as fs from 'fs';
import pdfParse from 'pdf-parse';
import { SlabType, ReinforcementElementType } from '../slab/enums/slab.enums';

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
const mockPdfParse = pdfParse as jest.MockedFunction<typeof pdfParse>;

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
              dimensions: {
                length: 1000,
                width: 800,
                thickness: 20,
                area: 800000,
              },
              type: SlabType.MONOLITHIC,
              beams: [],
              reinforcement: [],
              axes: { horizontal: [], vertical: [] },
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
              dimensions: {
                length: 1000,
                width: 800,
                thickness: 20,
                area: 800000,
              },
              type: SlabType.MONOLITHIC,
              beams: [],
              reinforcement: [
                {
                  elementId: 'R1',
                  elementType: ReinforcementElementType.STROP,
                  diameter: 12,
                  length: 1000,
                  quantity: 10,
                },
              ],
              axes: { horizontal: [], vertical: [] },
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

    it('should merge beams from structure file', () => {
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
              dimensions: {
                length: 1000,
                width: 800,
                thickness: 20,
                area: 800000,
              },
              type: SlabType.MONOLITHIC,
              beams: [
                {
                  symbol: 'B1',
                  quantity: 2,
                  mainRebarDiameter: 12,
                  stirrupDiameter: 6,
                  totalLength: 5,
                },
              ],
              reinforcement: [],
              axes: { horizontal: [], vertical: [] },
            },
            rawText: 'strop text',
            warnings: [],
          },
        },
        {
          fileName: 'konstrukcja.pdf',
          drawingType: 'structure',
          confidence: 90,
          isRecommended: true,
          extractedData: {
            sourceFile: 'konstrukcja.pdf',
            extractedAt: new Date(),
            slab: {
              id: 'STROP_1',
              dimensions: {
                length: 1000,
                width: 800,
                thickness: 20,
                area: 800000,
              },
              type: SlabType.MONOLITHIC,
              beams: [
                {
                  symbol: 'B2',
                  quantity: 3,
                  mainRebarDiameter: 16,
                  stirrupDiameter: 8,
                  totalLength: 6,
                },
              ],
              reinforcement: [],
              axes: { horizontal: [], vertical: [] },
            },
            rawText: 'konstrukcja text',
            warnings: [],
          },
        },
      ];

      const result = service.aggregateExtractedData(files);

      expect(result.slab).not.toBeNull();
      expect(result.slab?.beams).toHaveLength(2);
    });

    it('should use structure file slab when no slab file', () => {
      const files: RecognizedFile[] = [
        {
          fileName: 'konstrukcja.pdf',
          drawingType: 'structure',
          confidence: 90,
          isRecommended: true,
          extractedData: {
            sourceFile: 'konstrukcja.pdf',
            extractedAt: new Date(),
            slab: {
              id: 'STROP_1',
              dimensions: {
                length: 1000,
                width: 800,
                thickness: 20,
                area: 800000,
              },
              type: SlabType.MONOLITHIC,
              beams: [],
              reinforcement: [],
              axes: { horizontal: [], vertical: [] },
            },
            rawText: 'konstrukcja text',
            warnings: [],
          },
        },
      ];

      const result = service.aggregateExtractedData(files);

      expect(result.slab).not.toBeNull();
    });

    it('should handle recommended file with null extractedData', () => {
      const files: RecognizedFile[] = [
        {
          fileName: 'strop.pdf',
          drawingType: 'slab',
          confidence: 95,
          isRecommended: true,
          extractedData: null,
        },
      ];

      const result = service.aggregateExtractedData(files);

      expect(result.warnings).toContain('Nie znaleziono odpowiednich rysunków');
    });
  });

  describe('recognizeDrawingType - content patterns', () => {
    it('should recognize roof from content (krokiew)', () => {
      const result = service.recognizeDrawingType(
        'drawing.pdf',
        'krokiew główna 8x16',
      );

      expect(result.type).toBe('roof');
    });

    it('should recognize roof from content (płatew)', () => {
      const result = service.recognizeDrawingType(
        'drawing.pdf',
        'płatew kalenicowa',
      );

      expect(result.type).toBe('roof');
    });

    it('should recognize roof from content (murłata)', () => {
      const result = service.recognizeDrawingType(
        'drawing.pdf',
        'murłata 14x14',
      );

      expect(result.type).toBe('roof');
    });
  });

  describe('parsePdf - error handling', () => {
    it('should throw error when PDF parsing fails', async () => {
      mockPdfParse.mockRejectedValueOnce(new Error('Invalid PDF'));

      const buffer = Buffer.from('invalid pdf');

      await expect(service.parsePdf(buffer, 'invalid.pdf')).rejects.toThrow(
        'Invalid PDF',
      );
    });
  });

  describe('parseBatch - error handling', () => {
    it('should handle parsing and track successful count', async () => {
      const files = [
        { buffer: Buffer.from('valid'), filename: 'strop.pdf' },
        { buffer: Buffer.from('valid2'), filename: 'konstrukcja.pdf' },
      ];

      const result = await service.parseBatch(files);

      expect(result.totalFiles).toBe(2);
      expect(result.successfullyParsed).toBe(2);
      expect(result.files).toHaveLength(2);
    });

    it('should sort by confidence when isRecommended is same', async () => {
      const files = [
        { buffer: Buffer.from('content1'), filename: 'konstrukcja.pdf' },
        { buffer: Buffer.from('content2'), filename: 'strop_parter.pdf' },
      ];

      const result = await service.parseBatch(files);

      // Both are recommended, strop should be first (higher confidence 95 vs 90)
      expect(result.files[0].fileName).toBe('strop_parter.pdf');
    });
  });

  describe('extractSlabData (via parsePdf)', () => {
    it('should return slab with beams when pattern matches', async () => {
      mockPdfParse.mockResolvedValueOnce({
        numpages: 1,
        numrender: 1,
        text: 'B1 4 szt. ∅12 + ∅6 wieniec B25',
        info: {},
        metadata: {},
        version: '1.0',
      });

      const buffer = Buffer.from('pdf with beams');
      const result = await service.parsePdf(buffer, 'beams.pdf');

      expect(result.slab).not.toBeNull();
      expect(result.slab?.beams.length).toBeGreaterThan(0);
    });

    it('should extract beams with alternative pattern', async () => {
      mockPdfParse.mockResolvedValueOnce({
        numpages: 1,
        numrender: 1,
        text: 'B2 3 16 5,50',
        info: {},
        metadata: {},
        version: '1.0',
      });

      const buffer = Buffer.from('pdf with alt beams');
      const result = await service.parsePdf(buffer, 'alt-beams.pdf');

      expect(result.slab).not.toBeNull();
    });

    it('should extract reinforcement from table format', async () => {
      mockPdfParse.mockResolvedValueOnce({
        numpages: 1,
        numrender: 1,
        text: `Zestawienie prętów
W1
1 12 2,50 4`,
        info: {},
        metadata: {},
        version: '1.0',
      });

      const buffer = Buffer.from('pdf with reinforcement table');
      const result = await service.parsePdf(buffer, 'reinforcement.pdf');

      expect(result.slab).not.toBeNull();
    });

    it('should extract reinforcement from direct patterns', async () => {
      mockPdfParse.mockResolvedValueOnce({
        numpages: 1,
        numrender: 1,
        text: 'W1 zbrojenie 5 szt S2A pręty 3 szt B1 belka 2 szt',
        info: {},
        metadata: {},
        version: '1.0',
      });

      const buffer = Buffer.from('pdf with direct patterns');
      const result = await service.parsePdf(buffer, 'direct.pdf');

      expect(result.slab).not.toBeNull();
    });

    it('should return null slab when no beams or reinforcement found', async () => {
      mockPdfParse.mockResolvedValueOnce({
        numpages: 1,
        numrender: 1,
        text: 'Some random text without any construction data',
        info: {},
        metadata: {},
        version: '1.0',
      });

      const buffer = Buffer.from('pdf without data');
      const result = await service.parsePdf(buffer, 'empty.pdf');

      expect(result.slab).toBeNull();
      expect(result.warnings).toContain(
        'Nie znaleziono danych o stropie lub belkach',
      );
    });
  });

  describe('detectSlabType', () => {
    it('should detect TERIVA slab type', async () => {
      mockPdfParse.mockResolvedValueOnce({
        numpages: 1,
        numrender: 1,
        text: 'strop TERIVA 4.0 belka W1 2 szt',
        info: {},
        metadata: {},
        version: '1.0',
      });

      const buffer = Buffer.from('teriva pdf');
      const result = await service.parsePdf(buffer, 'teriva.pdf');

      expect(result.slab?.type).toBe('teriva');
    });

    it('should detect FILIGRAN slab type', async () => {
      mockPdfParse.mockResolvedValueOnce({
        numpages: 1,
        numrender: 1,
        text: 'płyta filigran W1 2 szt',
        info: {},
        metadata: {},
        version: '1.0',
      });

      const buffer = Buffer.from('filigran pdf');
      const result = await service.parsePdf(buffer, 'filigran.pdf');

      expect(result.slab?.type).toBe('filigran');
    });

    it('should detect ZEROWIEC slab type', async () => {
      mockPdfParse.mockResolvedValueOnce({
        numpages: 1,
        numrender: 1,
        text: 'strop żerański W1 2 szt',
        info: {},
        metadata: {},
        version: '1.0',
      });

      const buffer = Buffer.from('zerowiec pdf');
      const result = await service.parsePdf(buffer, 'zerowiec.pdf');

      expect(result.slab?.type).toBe('zerowiec');
    });
  });

  describe('extractConcreteClass', () => {
    it('should extract C class concrete', async () => {
      mockPdfParse.mockResolvedValueOnce({
        numpages: 1,
        numrender: 1,
        text: 'beton C30/37 W1 2 szt',
        info: {},
        metadata: {},
        version: '1.0',
      });

      const buffer = Buffer.from('c class pdf');
      const result = await service.parsePdf(buffer, 'concrete.pdf');

      expect(result.slab?.concreteClass).toBe('C30/37');
    });

    it('should extract B class concrete', async () => {
      mockPdfParse.mockResolvedValueOnce({
        numpages: 1,
        numrender: 1,
        text: 'beton B25 W1 2 szt',
        info: {},
        metadata: {},
        version: '1.0',
      });

      const buffer = Buffer.from('b class pdf');
      const result = await service.parsePdf(buffer, 'concrete-b.pdf');

      expect(result.slab?.concreteClass).toBe('B25');
    });

    it('should default to C25/30 when not found', async () => {
      mockPdfParse.mockResolvedValueOnce({
        numpages: 1,
        numrender: 1,
        text: 'W1 2 szt pręty',
        info: {},
        metadata: {},
        version: '1.0',
      });

      const buffer = Buffer.from('no concrete class pdf');
      const result = await service.parsePdf(buffer, 'default.pdf');

      expect(result.slab?.concreteClass).toBe('C25/30');
    });
  });

  describe('extractSteelClass', () => {
    it('should extract AIIIN steel class', async () => {
      mockPdfParse.mockResolvedValueOnce({
        numpages: 1,
        numrender: 1,
        text: 'stal AIIIN W1 2 szt',
        info: {},
        metadata: {},
        version: '1.0',
      });

      const buffer = Buffer.from('aiiin pdf');
      const result = await service.parsePdf(buffer, 'steel.pdf');

      expect(result.slab?.steelClass).toBe('AIIIN');
    });

    it('should extract B500SP steel class', async () => {
      mockPdfParse.mockResolvedValueOnce({
        numpages: 1,
        numrender: 1,
        text: 'stal B500SP W1 2 szt',
        info: {},
        metadata: {},
        version: '1.0',
      });

      const buffer = Buffer.from('b500sp pdf');
      const result = await service.parsePdf(buffer, 'steel-b500.pdf');

      expect(result.slab?.steelClass).toBe('B500SP');
    });
  });

  describe('extractNotes', () => {
    it('should extract notes starting with UWAGI', async () => {
      mockPdfParse.mockResolvedValueOnce({
        numpages: 1,
        numrender: 1,
        text: 'W1 2 szt UWAGI: Wykonać zgodnie z projektem konstrukcyjnym',
        info: {},
        metadata: {},
        version: '1.0',
      });

      const buffer = Buffer.from('notes pdf');
      const result = await service.parsePdf(buffer, 'notes.pdf');

      expect(result.slab?.notes).toBeDefined();
      expect(result.slab?.notes?.length).toBeGreaterThan(0);
    });

    it('should extract notes with dash prefix', async () => {
      mockPdfParse.mockResolvedValueOnce({
        numpages: 1,
        numrender: 1,
        text: 'W1 2 szt\n- Należy zachować odpowiednie otulenie zbrojenia minimum 25mm',
        info: {},
        metadata: {},
        version: '1.0',
      });

      const buffer = Buffer.from('dash notes pdf');
      const result = await service.parsePdf(buffer, 'dash-notes.pdf');

      expect(result.slab?.notes).toBeDefined();
    });
  });

  describe('extractAxes', () => {
    it('should extract numeric axes', async () => {
      mockPdfParse.mockResolvedValueOnce({
        numpages: 1,
        numrender: 1,
        text: 'osie 1 2 3 4 W1 2 szt',
        info: {},
        metadata: {},
        version: '1.0',
      });

      const buffer = Buffer.from('axes pdf');
      const result = await service.parsePdf(buffer, 'axes.pdf');

      expect(result.slab?.axes?.horizontal).toBeDefined();
    });

    it('should extract letter axes', async () => {
      mockPdfParse.mockResolvedValueOnce({
        numpages: 1,
        numrender: 1,
        text: 'osie A B C D W1 2 szt',
        info: {},
        metadata: {},
        version: '1.0',
      });

      const buffer = Buffer.from('letter axes pdf');
      const result = await service.parsePdf(buffer, 'letter-axes.pdf');

      expect(result.slab?.axes?.vertical).toBeDefined();
    });
  });

  describe('classifyElement (via reinforcement extraction)', () => {
    it('should classify L elements as nadproze', async () => {
      mockPdfParse.mockResolvedValueOnce({
        numpages: 1,
        numrender: 1,
        text: `Zestawienie prętów
Element
L1
1 12 2,50 4`,
        info: {},
        metadata: {},
        version: '1.0',
      });

      const buffer = Buffer.from('nadproze pdf');
      const result = await service.parsePdf(buffer, 'nadproze.pdf');

      expect(
        result.slab?.reinforcement.some(
          (r) => r.elementType === ReinforcementElementType.NADPROZE,
        ),
      ).toBe(true);
    });

    it('should classify ST elements as strop', async () => {
      mockPdfParse.mockResolvedValueOnce({
        numpages: 1,
        numrender: 1,
        text: `Zestawienie prętów
Element
ST1
1 12 2,50 4`,
        info: {},
        metadata: {},
        version: '1.0',
      });

      const buffer = Buffer.from('st pdf');
      const result = await service.parsePdf(buffer, 'st.pdf');

      expect(
        result.slab?.reinforcement.some(
          (r) => r.elementType === ReinforcementElementType.STROP,
        ),
      ).toBe(true);
    });

    it('should classify STR elements as strop', async () => {
      mockPdfParse.mockResolvedValueOnce({
        numpages: 1,
        numrender: 1,
        text: `Zestawienie prętów
Element
STR
1 12 2,50 4`,
        info: {},
        metadata: {},
        version: '1.0',
      });

      const buffer = Buffer.from('str pdf');
      const result = await service.parsePdf(buffer, 'str.pdf');

      expect(
        result.slab?.reinforcement.some(
          (r) => r.elementType === ReinforcementElementType.STROP,
        ),
      ).toBe(true);
    });
  });
});
