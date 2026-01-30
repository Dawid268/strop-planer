/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import pdfParse from 'pdf-parse';
import {
  ExtractedPdfData,
  SlabData,
  BeamData,
  ReinforcementData,
} from '../slab/interfaces/slab.interface';
import { SlabType, ReinforcementElementType } from '../slab/enums/slab.enums';

// Drawing type for recognition
export type DrawingType =
  | 'slab'
  | 'structure'
  | 'reinforcement'
  | 'architecture'
  | 'roof'
  | 'foundation'
  | 'other';

export interface RecognizedFile {
  fileName: string;
  drawingType: DrawingType;
  confidence: number; // 0-100
  isRecommended: boolean;
  extractedData: ExtractedPdfData | null;
}

export interface BatchUploadResult {
  files: RecognizedFile[];
  recommendedFiles: string[];
  totalFiles: number;
  successfullyParsed: number;
}

// Basic interface for pdf-parse result
interface PdfParseResult {
  numpages: number;
  numrender: number;
  info: Record<string, unknown>;
  metadata: Record<string, unknown>;
  text: string;
  version: string;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  constructor() {}

  /**
   * Parsuje plik PDF i ekstrahuje dane konstrukcyjne
   */
  public async parsePdf(
    buffer: Buffer,
    filename: string,
  ): Promise<ExtractedPdfData> {
    const warnings: string[] = [];
    const geometry = undefined;

    try {
      const pdfData = (await pdfParse(buffer)) as PdfParseResult;
      const rawText = pdfData.text;

      this.logger.log(`Parsing PDF: ${filename}, pages: ${pdfData.numpages}`);

      const uploadDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const uniqueFilename = `${Date.now()}_${filename.replace(/\s+/g, '_')}`;
      const filePath = path.join(uploadDir, uniqueFilename);
      fs.writeFileSync(filePath, buffer);

      // Geometry extraction is now handled asynchronously via GeometryService.startExtraction
      // triggered by the frontend after project creation.
      // We skip it here to avoid blocking and legacy errors.

      const slab = this.extractSlabData(rawText, warnings);

      return {
        sourceFile: `/uploads/${uniqueFilename}`,
        extractedAt: new Date(),
        slab,
        rawText,
        warnings,
        geometry,
      };
    } catch (error) {
      this.logger.error(`Failed to parse PDF: ${filename}`, error);
      throw error;
    }
  }

  /**
   * Przetwarza wiele plików PDF i rozpoznaje typy rysunków
   */
  public async parseBatch(
    files: Array<{ buffer: Buffer; filename: string }>,
  ): Promise<BatchUploadResult> {
    const results: RecognizedFile[] = [];
    const recommendedFiles: string[] = [];
    let successfullyParsed = 0;

    for (const file of files) {
      try {
        const pdfData = (await pdfParse(file.buffer)) as PdfParseResult;
        const rawText = pdfData.text;

        const { type, confidence } = this.recognizeDrawingType(
          file.filename,
          rawText,
        );
        const isRecommended = this.isRecommendedForFormwork(type);

        const extractedData = await this.parsePdf(file.buffer, file.filename);

        results.push({
          fileName: file.filename,
          drawingType: type,
          confidence,
          isRecommended,
          extractedData,
        });

        if (isRecommended) {
          recommendedFiles.push(file.filename);
        }
        successfullyParsed++;
      } catch (error) {
        this.logger.warn(`Failed to parse file: ${file.filename}`, error);
        results.push({
          fileName: file.filename,
          drawingType: 'other',
          confidence: 0,
          isRecommended: false,
          extractedData: null,
        });
      }
    }

    // Sort: recommended first, then by confidence
    results.sort((a, b) => {
      if (a.isRecommended !== b.isRecommended) {
        return a.isRecommended ? -1 : 1;
      }
      return b.confidence - a.confidence;
    });

    return {
      files: results,
      recommendedFiles,
      totalFiles: files.length,
      successfullyParsed,
    };
  }

  /**
   * Rozpoznaje typ rysunku na podstawie nazwy pliku i zawartości
   */
  public recognizeDrawingType(
    filename: string,
    content: string,
  ): { type: DrawingType; confidence: number } {
    const lowerFilename = filename.toLowerCase();
    const lowerContent = content.toLowerCase().substring(0, 2000);

    // Check filename patterns first (highest confidence)
    if (/strop|ceiling|slab|k\d.*strop/i.test(lowerFilename)) {
      return { type: 'slab', confidence: 95 };
    }
    if (/konstrukc|structure|k\d.*konstr/i.test(lowerFilename)) {
      return { type: 'structure', confidence: 90 };
    }
    if (/zbrojeni|reinforce|prętów|pret/i.test(lowerFilename)) {
      return { type: 'reinforcement', confidence: 90 };
    }
    if (/więźba|wiezba|dach|roof|krokiew/i.test(lowerFilename)) {
      return { type: 'roof', confidence: 85 };
    }
    if (/fundament|foundation|ław/i.test(lowerFilename)) {
      return { type: 'foundation', confidence: 85 };
    }
    if (/rzut.*part|rzut.*podd|archit|floor.*plan/i.test(lowerFilename)) {
      return { type: 'architecture', confidence: 80 };
    }

    // Check content patterns (lower confidence)
    if (/strop|ceiling|slab/i.test(lowerContent)) {
      return { type: 'slab', confidence: 70 };
    }
    if (/belk[ai]|beam|wieniec/i.test(lowerContent)) {
      return { type: 'structure', confidence: 65 };
    }
    if (/∅\d+|⌀\d+|zbrojenie|stal/i.test(lowerContent)) {
      return { type: 'reinforcement', confidence: 60 };
    }
    if (/krokiew|płatew|murłata/i.test(lowerContent)) {
      return { type: 'roof', confidence: 60 };
    }

    return { type: 'other', confidence: 30 };
  }

  /**
   * Sprawdza czy typ rysunku jest przydatny do szalunków
   */
  private isRecommendedForFormwork(type: DrawingType): boolean {
    return ['slab', 'structure', 'reinforcement'].includes(type);
  }

  /**
   * Agreguje dane z wielu plików
   */
  public aggregateExtractedData(files: RecognizedFile[]): ExtractedPdfData {
    const recommended = files.filter((f) => f.isRecommended && f.extractedData);

    if (recommended.length === 0) {
      return {
        sourceFile: 'batch',
        extractedAt: new Date(),
        slab: null,
        rawText: '',
        warnings: ['Nie znaleziono odpowiednich rysunków'],
      };
    }

    const slabFile = recommended.find((f) => f.drawingType === 'slab');
    const structureFile = recommended.find(
      (f) => f.drawingType === 'structure',
    );
    const reinforcementFile = recommended.find(
      (f) => f.drawingType === 'reinforcement',
    );

    const baseSlab =
      slabFile?.extractedData?.slab || structureFile?.extractedData?.slab;

    if (baseSlab && structureFile?.extractedData?.slab?.beams) {
      baseSlab.beams = [
        ...baseSlab.beams,
        ...structureFile.extractedData.slab.beams,
      ];
    }

    if (baseSlab && reinforcementFile?.extractedData?.slab?.reinforcement) {
      baseSlab.reinforcement = [
        ...baseSlab.reinforcement,
        ...reinforcementFile.extractedData.slab.reinforcement,
      ];
    }

    return {
      sourceFile: recommended.map((f) => f.fileName).join(', '),
      extractedAt: new Date(),
      slab: baseSlab,
      rawText: recommended
        .map((f) => f.extractedData?.rawText || '')
        .join('\n\n---\n\n'),
      warnings: recommended.flatMap((f) => f.extractedData?.warnings || []),
    };
  }

  // ============================================
  // PRIVATE EXTRACTION METHODS
  // ============================================

  private extractSlabData(text: string, warnings: string[]): SlabData | null {
    const beams = this.extractBeams(text, warnings);
    const reinforcement = this.extractReinforcement(text);
    const axes = this.extractAxes(text);

    if (beams.length === 0 && reinforcement.length === 0) {
      warnings.push('Nie znaleziono danych o stropie lub belkach');
      return null;
    }

    const dimensions = this.estimateDimensions();

    return {
      id: 'STROP_1',
      dimensions,
      type: this.detectSlabType(text),
      beams,
      reinforcement,
      axes,
      concreteClass: this.extractConcreteClass(text),
      steelClass: this.extractSteelClass(text),
      notes: this.extractNotes(text),
    };
  }

  private extractBeams(text: string, warnings: string[]): BeamData[] {
    const beams: BeamData[] = [];
    const beamPattern =
      /B(\d+)\s+(\d+)\s+szt\.?\s*[∅⌀]?(\d+)\s*[+×x]\s*[∅⌀]?(\d+)/gi;
    let match: RegExpExecArray | null;

    match = beamPattern.exec(text);
    while (match !== null) {
      beams.push({
        symbol: `B${match[1]}`,
        quantity: parseInt(match[2], 10),
        mainRebarDiameter: parseInt(match[3], 10),
        stirrupDiameter: parseInt(match[4], 10),
        totalLength: 0,
      });
      match = beamPattern.exec(text);
    }

    const altPattern = /B(\d+)\s+(\d+)\s+(\d+)\s+([\d,.]+)/g;
    match = altPattern.exec(text);
    while (match !== null) {
      const existing = beams.find((b) => b.symbol === `B${match![1]}`);
      if (!existing) {
        beams.push({
          symbol: `B${match[1]}`,
          quantity: parseInt(match[2], 10),
          mainRebarDiameter: parseInt(match[3], 10),
          stirrupDiameter: 6,
          totalLength: parseFloat(match[4].replace(',', '.')),
        });
      }
      match = altPattern.exec(text);
    }

    if (beams.length === 0) {
      warnings.push('Nie znaleziono belek w dokumencie');
    }

    return beams;
  }

  private extractReinforcement(text: string): ReinforcementData[] {
    const reinforcement: ReinforcementData[] = [];
    const lines = text.split('\n');
    let currentElement = '';
    let inTable = false;

    for (const line of lines) {
      if (line.includes('Zestawienie prętów') || line.includes('Element')) {
        inTable = true;
        continue;
      }

      const elementMatch = line.match(
        /^(W\d+|B\d+|S\d+[AB]?|L\d+|T\d+|ST\d+|STR)/,
      );
      if (elementMatch) {
        currentElement = elementMatch[1];
      }

      if (inTable && currentElement) {
        const dataMatch = line.match(/(\d+)\s+(\d+)\s+([\d,.]+)\s+(\d+)/);
        if (dataMatch) {
          reinforcement.push({
            elementId: currentElement,
            elementType: this.classifyElement(currentElement),
            diameter: parseInt(dataMatch[2], 10),
            length: parseFloat(dataMatch[3].replace(',', '.')),
            quantity: parseInt(dataMatch[4], 10),
          });
        }
      }
    }

    const directPatterns: Array<{
      pattern: RegExp;
      type: ReinforcementElementType;
    }> = [
      {
        pattern: /W(\d+)\s*.*?(\d+)\s+szt/gi,
        type: ReinforcementElementType.WIENIEC,
      },
      {
        pattern: /B(\d+)\s*.*?(\d+)\s+szt/gi,
        type: ReinforcementElementType.BELKA,
      },
      {
        pattern: /S(\d+[AB]?)\s*.*?(\d+)\s+szt/gi,
        type: ReinforcementElementType.STROP,
      },
    ];

    for (const { pattern, type } of directPatterns) {
      let match: RegExpExecArray | null;
      match = pattern.exec(text);
      while (match !== null) {
        const id =
          type === 'wieniec'
            ? `W${match[1]}`
            : type === 'belka'
              ? `B${match[1]}`
              : `S${match[1]}`;
        if (!reinforcement.some((r) => r.elementId === id)) {
          reinforcement.push({
            elementId: id,
            elementType: type,
            diameter: 12,
            length: 0,
            quantity: parseInt(match[2], 10),
          });
        }
        match = pattern.exec(text);
      }
    }

    return reinforcement;
  }

  private extractAxes(text: string): {
    horizontal: string[];
    vertical: string[];
  } {
    const horizontal: string[] = [];
    const vertical: string[] = [];

    const numericAxes = text.match(/\b(\d+[A-F]?)\b/g);
    if (numericAxes) {
      const uniqueNumeric = [...new Set(numericAxes)].filter((a) =>
        /^\d+[A-F]?$/.test(a),
      );
      horizontal.push(...uniqueNumeric.sort());
    }

    const letterAxes = text.match(/\b([A-F])\b/g);
    if (letterAxes) {
      const uniqueLetters = [...new Set(letterAxes)].filter((a) =>
        /^[A-F]$/.test(a),
      );
      vertical.push(...uniqueLetters.sort());
    }

    return { horizontal, vertical };
  }

  private classifyElement(id: string): ReinforcementElementType {
    if (id.startsWith('W')) return ReinforcementElementType.WIENIEC;
    if (id.startsWith('B')) return ReinforcementElementType.BELKA;
    if (id.startsWith('S') || id === 'STR' || id.startsWith('ST'))
      return ReinforcementElementType.STROP;
    if (id.startsWith('L')) return ReinforcementElementType.NADPROZE;
    return ReinforcementElementType.STROP;
  }

  private detectSlabType(text: string): SlabType {
    const normalizedText = text.toLowerCase();
    if (normalizedText.includes('teriva')) return SlabType.TERIVA;
    if (normalizedText.includes('filigran')) return SlabType.FILIGRAN;
    if (normalizedText.includes('żerańsk') || normalizedText.includes('zerow'))
      return SlabType.ZEROWIEC;
    if (
      normalizedText.includes('monolityczn') ||
      normalizedText.includes('żelbet')
    )
      return SlabType.MONOLITHIC;
    return SlabType.MONOLITHIC;
  }

  private estimateDimensions(): SlabData['dimensions'] {
    return {
      length: 12.0,
      width: 10.0,
      thickness: 20,
      area: 120.0,
    };
  }

  private extractConcreteClass(text: string): string | undefined {
    const match = text.match(/C(\d+)\/(\d+)|B(\d+)/);
    if (match) {
      if (match[1] && match[2]) return `C${match[1]}/${match[2]}`;
      if (match[3]) return `B${match[3]}`;
    }
    return 'C25/30';
  }

  private extractSteelClass(text: string): string | undefined {
    const match = text.match(/AIIIN|RB500W|B500SP|BSt500S/i);
    return match ? match[0].toUpperCase() : 'AIIIN(RB500W)';
  }

  private extractNotes(text: string): string[] {
    const notes: string[] = [];
    const notePatterns = [
      /UWAGI?:?\s*([^\n]+)/gi,
      /-\s*([A-ZŻŹĆĄŚĘŁÓŃ][^\n]{20,})/g,
    ];

    for (const pattern of notePatterns) {
      let match: RegExpExecArray | null;
      match = pattern.exec(text);
      while (match !== null) {
        const note = match[1].trim();
        if (note.length > 10 && !notes.includes(note)) {
          notes.push(note);
        }
        match = pattern.exec(text);
      }
    }

    return notes;
  }
}
