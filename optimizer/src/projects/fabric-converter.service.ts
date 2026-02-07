import { Injectable, Logger } from '@nestjs/common';
import { DxfData, DxfEntity } from '@/floor-plan/dxf-conversion.service';

// Performance limit - prevent browser freeze with huge DXF files
// Points limit - prevent browser freeze with extremely complex geometry
const MAX_TOTAL_POINTS = 30000;

export interface FabricEntity {
  type: 'line' | 'circle' | 'polyline' | 'text';
  layer: string;
  stroke: string;
  [key: string]: unknown;
}

@Injectable()
export class FabricConverterService {
  private readonly logger = new Logger(FabricConverterService.name);

  public convertToFabric(dxfData: DxfData): {
    metadata: Record<string, unknown>;
    bounds: DxfData['bounds'];
    layers: Record<string, FabricEntity[]>;
  } {
    const { entities, bounds } = dxfData;

    // 1. Initial filter
    const filteredEntities = entities.filter((e: DxfEntity) =>
      this.isSignificant(e),
    );

    // 2. High-performance deduplication
    const uniqueEntities = this.deduplicateEntities(filteredEntities);

    // 3. Mapping with explosion of polylines into individual segments
    const rawFabricEntities: FabricEntity[] = [];
    for (const entity of uniqueEntities) {
      const exploded = this.explodeEntity(entity, bounds.maxY);
      if (exploded && exploded.length > 0) {
        rawFabricEntities.push(...exploded);
      }
    }

    // 4. Grouping by layer and point limiting
    const layers: Record<string, FabricEntity[]> = {};
    let currentPointCount = 0;
    let wasLimited = false;

    for (const entity of rawFabricEntities) {
      const layerName = entity.layer || '0';

      // After explosion, we mostly have lines (2 points) or circles (8 points weight)
      const entityPoints = entity.type === 'line' ? 2 : 8;

      if (currentPointCount + entityPoints > MAX_TOTAL_POINTS) {
        wasLimited = true;
        break;
      }

      if (!layers[layerName]) layers[layerName] = [];
      layers[layerName].push(entity);
      currentPointCount += entityPoints;
    }

    if (wasLimited) {
      this.logger.warn(
        `CAD data limited to ${currentPointCount} points (${MAX_TOTAL_POINTS} limit).`,
      );
    }

    this.logger.log(
      `CAD conversion: ${entities.length} raw -> ${uniqueEntities.length} unique -> ${currentPointCount} total points across ${Object.keys(layers).length} layers.`,
    );

    return {
      metadata: {
        totalEntities: entities.length,
        uniqueEntities: uniqueEntities.length,
        totalPoints: currentPointCount,
        layerCount: Object.keys(layers).length,
        wasLimited,
      },
      bounds,
      layers,
    };
  }

  private deduplicateEntities(entities: DxfEntity[]): DxfEntity[] {
    const seen = new Set<string>();
    return entities.filter((entity: DxfEntity) => {
      const key = this.getEntityKey(entity);
      if (!key) return true; // Can't dedup unknown types reliably
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private getEntityKey(entity: DxfEntity): string {
    // Round to 1mm precision for robust deduping (assuming units are mm)
    const round = (val: number) => Math.round(val);

    switch (entity.type) {
      case 'LINE':
        if (entity.startPoint && entity.endPoint) {
          const x1 = round(entity.startPoint.x);
          const y1 = round(entity.startPoint.y);
          const x2 = round(entity.endPoint.x);
          const y2 = round(entity.endPoint.y);
          // Sort points to make key direction-independent
          return x1 < x2 || (x1 === x2 && y1 < y2)
            ? `L:${x1},${y1}-${x2},${y2}`
            : `L:${x2},${y2}-${x1},${y1}`;
        }
        break;
      case 'CIRCLE':
        if (entity.center) {
          return `C:${round(entity.center.x)},${round(entity.center.y)},${round(entity.radius || 0)}`;
        }
        break;
      case 'LWPOLYLINE':
      case 'POLYLINE':
        if (entity.vertices && entity.vertices.length > 0) {
          // Key based on first and last vertex + length for efficient but decent dedup
          const first = entity.vertices[0];
          const last = entity.vertices[entity.vertices.length - 1];
          return `P:${entity.vertices.length}:${round(first.x)},${round(first.y)}-${round(last.x)},${round(last.y)}`;
        }
        break;
    }
    return '';
  }

  private isSignificant(entity: DxfEntity): boolean {
    // Skip noise (lines < 5 units)
    if (entity.type === 'LINE' && entity.startPoint && entity.endPoint) {
      const dx = entity.endPoint.x - entity.startPoint.x;
      const dy = entity.endPoint.y - entity.startPoint.y;
      return dx * dx + dy * dy > 25;
    }

    if (entity.type === 'POLYLINE' || entity.type === 'LWPOLYLINE') {
      return (entity.vertices?.length ?? 0) >= 2;
    }

    if (entity.type === 'CIRCLE') return (entity.radius || 0) > 1;

    // Skip all text-like entities for the planning view
    if (
      entity.type === 'TEXT' ||
      entity.type === 'MTEXT' ||
      entity.type === 'DIMENSION'
    ) {
      return false;
    }

    return true;
  }

  /**
   * Explodes DXF entities into simple Fabric-compatible objects.
   * Polylines are exploded into individual line segments here to:
   * 1. Reduce payload size (less nesting, simpler points)
   * 2. Optimize frontend selection (segments are already separate)
   * 3. Lower client-side CPU usage
   */
  private explodeEntity(entity: DxfEntity, maxY: number): FabricEntity[] {
    const stroke = this.getColor(entity.color);
    const layer = entity.layer || 'default';
    const round = (val: number) => Math.round(val * 10) / 10;

    switch (entity.type) {
      case 'LINE':
        if (!entity.startPoint || !entity.endPoint) return [];
        return [
          {
            type: 'line',
            layer,
            stroke,
            x1: round(entity.startPoint.x),
            y1: round(maxY - entity.startPoint.y),
            x2: round(entity.endPoint.x),
            y2: round(maxY - entity.endPoint.y),
          },
        ];

      case 'CIRCLE':
        if (!entity.center || typeof entity.radius !== 'number') return [];
        return [
          {
            type: 'circle',
            layer,
            stroke,
            left: round(entity.center.x),
            top: round(maxY - entity.center.y),
            radius: round(entity.radius),
          },
        ];

      case 'LWPOLYLINE':
      case 'POLYLINE':
        if (entity.vertices && entity.vertices.length > 1) {
          const segments: FabricEntity[] = [];
          for (let i = 0; i < entity.vertices.length - 1; i++) {
            const v1 = entity.vertices[i];
            const v2 = entity.vertices[i + 1];
            segments.push({
              type: 'line',
              layer,
              stroke,
              x1: round(v1.x),
              y1: round(maxY - v1.y),
              x2: round(v2.x),
              y2: round(maxY - v2.y),
            });
          }
          return segments;
        }
        break;
    }
    return [];
  }

  private getColor(dxfColor: unknown): string {
    if (typeof dxfColor === 'string') return dxfColor;
    const aci: Record<number, string> = {
      1: '#ff4444',
      2: '#ffff44',
      3: '#44ff44',
      4: '#44ffff',
      5: '#4444ff',
      6: '#ff44ff',
      7: '#cccccc',
      8: '#888888',
      9: '#aaaaaa',
    };
    return aci[Number(dxfColor)] || '#aaaaaa';
  }
}
