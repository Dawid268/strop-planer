import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const DxfParser = require('dxf-parser');
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface DxfEntity {
  type: string;
  layer: string;
  vertices?: Array<{ x: number; y: number }>;
  center?: { x: number; y: number };
  radius?: number;
  startPoint?: { x: number; y: number };
  endPoint?: { x: number; y: number };
  text?: string;
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
  private readonly parser: any;

  constructor() {
    this.parser = new DxfParser();
  }

  public async convertPdfToDxf(
    pdfPath: string,
    outputPath: string,
  ): Promise<void> {
    try {
      this.logger.log(`Starting PDF to DXF conversion: ${pdfPath}`);
      // Use Inkscape CLI to export to DXF
      // Note: Inkscape > 1.0 uses --export-type and --export-filename
      const command = `inkscape --export-type=dxf --export-filename="${outputPath}" "${pdfPath}"`;

      this.logger.debug(`Executing command: ${command}`);
      const { stdout, stderr } = await execAsync(command);

      if (stderr) {
        this.logger.warn(`Inkscape stderr: ${stderr}`);
      }
      this.logger.log(`Conversion completed: ${outputPath}`);
    } catch (error: any) {
      this.logger.error(`PDF to DXF conversion failed`, error.stack);
      throw new Error(`PDF to DXF conversion failed: ${error.message}`);
    }
  }

  public async parseDxfFile(dxfPath: string): Promise<DxfData> {
    try {
      const fileContent = await fs.readFile(dxfPath, 'utf-8');
      const dxf = this.parser.parseSync(fileContent);

      return this.transformDxfToSimpleFormat(dxf);
    } catch (error: any) {
      this.logger.error(`DXF parsing failed: ${dxfPath}`, error.stack);
      throw new Error(`DXF parsing failed: ${error.message}`);
    }
  }

  private transformDxfToSimpleFormat(dxf: any): DxfData {
    const entities: DxfEntity[] = [];
    const layersSet = new Set<string>();

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const updateBounds = (x: number, y: number) => {
      if (typeof x !== 'number' || typeof y !== 'number') return;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    };

    const processEntity = (entity: any) => {
      if (!entity) return;
      layersSet.add(entity.layer || 'default');

      try {
        switch (entity.type) {
          case 'LINE':
            if (entity.vertices && entity.vertices.length >= 2) {
              entities.push({
                type: 'LINE',
                layer: entity.layer,
                startPoint: {
                  x: entity.vertices[0].x,
                  y: entity.vertices[0].y,
                },
                endPoint: { x: entity.vertices[1].x, y: entity.vertices[1].y },
              });
              updateBounds(entity.vertices[0].x, entity.vertices[0].y);
              updateBounds(entity.vertices[1].x, entity.vertices[1].y);
            }
            break;

          case 'LWPOLYLINE':
          case 'POLYLINE':
            if (entity.vertices && entity.vertices.length > 0) {
              const vertices = entity.vertices.map((v: any) => ({
                x: v.x,
                y: v.y,
              }));
              entities.push({
                type: 'POLYLINE',
                layer: entity.layer,
                vertices,
              });
              vertices.forEach((v: any) => updateBounds(v.x, v.y));
            }
            break;

          case 'CIRCLE':
            if (entity.center && typeof entity.radius === 'number') {
              entities.push({
                type: 'CIRCLE',
                layer: entity.layer,
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

          case 'ARC':
            if (entity.center && typeof entity.radius === 'number') {
              entities.push({
                type: 'ARC',
                layer: entity.layer,
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
          case 'MTEXT':
            if (entity.startPoint || entity.position) {
              // Some parsers use position
              const p = entity.startPoint || entity.position;
              entities.push({
                type: 'TEXT',
                layer: entity.layer,
                startPoint: { x: p.x, y: p.y },
                text: entity.text || entity.string, // Some parsers use string
              });
              updateBounds(p.x, p.y);
            }
            break;
        }
      } catch (e) {
        Logger.warn(
          `Failed to process entity ${entity.type}`,
          DxfConversionService.name,
        );
      }
    };

    if (dxf.entities && Array.isArray(dxf.entities)) {
      for (const entity of dxf.entities) {
        processEntity(entity);
      }
    }

    return {
      entities,
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
