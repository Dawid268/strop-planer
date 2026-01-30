import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import DxfParser from 'dxf-parser';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { FLOOR_PLAN_CONSTANTS } from './constants/floor-plan.constants';

const execAsync = promisify(exec);

export interface DxfVertex {
  x: number;
  y: number;
}

export interface DxfEntity {
  type: string;
  layer: string;
  vertices?: DxfVertex[];
  radius?: number;
  startPoint?: DxfVertex;
  position?: DxfVertex;
  center?: DxfVertex;
  endPoint?: DxfVertex;
  text?: string;
  string?: string;
  [key: string]: unknown;
}

interface RawDxfEntity {
  type: string;
  layer?: string;
  vertices?: Array<{ x: number; y: number }>;
  center?: { x: number; y: number };
  radius?: number;
  startPoint?: { x: number; y: number };
  position?: { x: number; y: number };
  text?: string;
  string?: string;
}

interface RawDxf {
  entities?: RawDxfEntity[];
}

export interface DxfData {
  entities: DxfEntity[];
  layers: string[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

@Injectable()
export class DxfConversionService {
  private readonly logger = new Logger(DxfConversionService.name);
  private readonly parser: DxfParser;

  constructor() {
    this.parser = new DxfParser();
  }

  public async processUploadedFile(
    file: Express.Multer.File,
  ): Promise<{ documentId: string; data: DxfData }> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const documentId = path.parse(file.filename).name;
    const ext = path.extname(file.filename).toLowerCase();

    this.logger.log(`Processing upload: ${file.filename} (ID: ${documentId})`, {
      documentId,
      ext,
    });

    try {
      let dxfData: DxfData;

      if (ext === '.pdf') {
        const dxfPath = path.join(
          FLOOR_PLAN_CONSTANTS.UPLOAD_DIR,
          `${documentId}.dxf`,
        );
        await this.convertPdfToDxf(file.path, dxfPath);
        dxfData = await this.parseDxfFile(dxfPath);
      } else {
        dxfData = await this.parseDxfFile(file.path);
      }

      await fs.mkdir(FLOOR_PLAN_CONSTANTS.CONVERTED_DIR, { recursive: true });
      const finalJsonPath = path.join(
        FLOOR_PLAN_CONSTANTS.CONVERTED_DIR,
        `${documentId}.json`,
      );

      await fs.writeFile(finalJsonPath, JSON.stringify(dxfData, null, 2));

      return { documentId, data: dxfData };
    } catch (error) {
      this.logger.error(`Processing failed for ${documentId}`, {
        documentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new BadRequestException(
        `Processing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  public async getFloorPlanData(documentId: string): Promise<DxfData> {
    const jsonPath = path.join(
      FLOOR_PLAN_CONSTANTS.CONVERTED_DIR,
      `${documentId}.json`,
    );
    try {
      const jsonContent = await fs.readFile(jsonPath, 'utf-8');
      return JSON.parse(jsonContent) as DxfData;
    } catch {
      this.logger.warn(`Floor plan data not found: ${documentId}`, {
        documentId,
      });
      throw new BadRequestException('Floor plan data not found');
    }
  }

  public async getRawDxfContent(documentId: string): Promise<string> {
    const dxfPath = path.join(
      FLOOR_PLAN_CONSTANTS.UPLOAD_DIR,
      `${documentId}.dxf`,
    );
    try {
      await fs.access(dxfPath);
      return await fs.readFile(dxfPath, 'utf-8');
    } catch {
      this.logger.warn(`DXF file not found: ${documentId}`, { documentId });
      throw new BadRequestException('DXF file not found');
    }
  }

  public async convertPdfToDxf(
    pdfPath: string,
    outputPath: string,
  ): Promise<void> {
    try {
      this.logger.log(`Starting PDF to DXF conversion: ${pdfPath}`);
      const command = `inkscape --export-type=dxf --export-filename="${outputPath}" "${pdfPath}"`;

      const { stderr } = (await execAsync(command)) as {
        stdout: string;
        stderr: string;
      };
      if (stderr) {
        this.logger.warn(`Inkscape stderr: ${stderr}`);
      }
      this.logger.log(`Conversion completed: ${outputPath}`);
    } catch (error) {
      this.logger.error(`PDF to DXF conversion failed`, {
        pdfPath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `PDF to DXF conversion failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  public async parseDxfFile(dxfPath: string): Promise<DxfData> {
    try {
      const fileContent = await fs.readFile(dxfPath, 'utf-8');
      const dxf = this.parser.parseSync(fileContent);
      return this.transformDxfToSimpleFormat(dxf);
    } catch (error) {
      this.logger.error(`DXF parsing failed: ${dxfPath}`, {
        dxfPath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `DXF parsing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private transformDxfToSimpleFormat(dxf: RawDxf): DxfData {
    const sortedEntities: DxfEntity[] = [];
    const layersSet = new Set<string>();

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const updateBounds = (x: number, y: number): void => {
      if (typeof x !== 'number' || typeof y !== 'number') return;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    };

    const processEntity = (entity: RawDxfEntity): void => {
      if (!entity) return;
      layersSet.add(entity.layer || 'default');

      switch (entity.type) {
        case 'LINE':
          if (entity.vertices && entity.vertices.length >= 2) {
            sortedEntities.push({
              type: 'LINE',
              layer: entity.layer || 'default',
              startPoint: { x: entity.vertices[0].x, y: entity.vertices[0].y },
              endPoint: { x: entity.vertices[1].x, y: entity.vertices[1].y },
            });
            updateBounds(entity.vertices[0].x, entity.vertices[0].y);
            updateBounds(entity.vertices[1].x, entity.vertices[1].y);
          }
          break;
        case 'LWPOLYLINE':
        case 'POLYLINE':
          if (entity.vertices && entity.vertices.length > 0) {
            const vertices: DxfVertex[] = entity.vertices.map(
              (v: { x: number; y: number }) => ({
                x: v.x,
                y: v.y,
              }),
            );
            sortedEntities.push({
              type: 'POLYLINE',
              layer: entity.layer || 'default',
              vertices,
            });
            vertices.forEach((v: DxfVertex) => updateBounds(v.x, v.y));
          }
          break;
        case 'CIRCLE':
        case 'ARC':
          if (entity.center && typeof entity.radius === 'number') {
            sortedEntities.push({
              type: entity.type,
              layer: entity.layer || 'default',
              center: { x: entity.center.x, y: entity.center.y },
              radius: entity.radius,
            });
            updateBounds(
              entity.center.x - entity.radius,
              entity.center.y - entity.radius,
            );
            updateBounds(
              entity.center.x + entity.radius,
              entity.center.y + entity.radius,
            );
          }
          break;
        case 'TEXT':
        case 'MTEXT': {
          const p = entity.startPoint || entity.position;
          if (p) {
            sortedEntities.push({
              type: 'TEXT',
              layer: entity.layer || 'default',
              startPoint: { x: p.x, y: p.y },
              text: entity.text || entity.string,
            });
            updateBounds(p.x, p.y);
          }
          break;
        }
      }
    };

    if (dxf.entities && Array.isArray(dxf.entities)) {
      dxf.entities.forEach(processEntity);
    }

    return {
      entities: sortedEntities,
      layers: Array.from(layersSet),
      bounds: {
        minX: minX === Infinity ? 0 : minX,
        minY: minY === Infinity ? 0 : minY,
        maxX: maxX === -Infinity ? 100 : maxX,
        maxY: maxY === -Infinity ? 100 : maxY,
      },
    };
  }
}
