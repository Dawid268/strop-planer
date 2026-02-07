import { fabric } from 'fabric';

/** Custom data attached to Fabric objects for identification and metadata */
export interface CustomObjectData {
  id?: string;
  isGrid?: boolean;
  isFromSvg?: boolean;
  isFromGeometry?: boolean;
  isWallLine?: boolean;
  isCadEntity?: boolean;
  type?: string;
  layerId?: string;
  layerName?: string;
  chunkId?: string;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  radius?: number;
  left?: number;
  top?: number;
}

/** Extended Fabric.js object with custom data */
export interface CustomFabricObject extends fabric.Object {
  customData?: CustomObjectData;
}

/** Extended Fabric.js canvas with panning state */
export interface ExtendedFabricCanvas extends fabric.Canvas {
  isDragging?: boolean;
  lastPosX?: number;
  lastPosY?: number;
}

export interface CanvasPoint {
  x: number;
  y: number;
}

export const CANVAS_COLORS = {
  GRID: '#e0e0e0',
  BEAM: '#ff6600',
  POLYGON_FILL: 'rgba(100, 149, 237, 0.4)',
  POLYGON_STROKE: '#1565c0',
  TRACE_MARKER_FILL: '#f44336',
  TRACE_MARKER_STROKE: '#b71c1c',
  PANEL_FILL: 'rgba(200, 230, 201, 0.8)',
  PANEL_STROKE: '#2e7d32',
  PROP_FILL: '#ffeb3b',
  PROP_STROKE: '#f57c00',
  SNAP_GUIDE: '#f44336',
};

export function getDistance(p1: CanvasPoint, p2: CanvasPoint): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Normalize polygon/segment from API: { points }, plain [{x,y}], or segment { a, b }.
 * Returns array of points for consistent use in canvas/geometry.
 */
export function getPolygonPoints(poly: unknown): CanvasPoint[] {
  if (!poly || typeof poly !== 'object') return [];
  const p = poly as
    | { points?: CanvasPoint[]; a?: CanvasPoint; b?: CanvasPoint }
    | CanvasPoint[];
  if (Array.isArray(p)) {
    return p.every(
      (e) => e != null && typeof e === 'object' && 'x' in e && 'y' in e,
    )
      ? (p as CanvasPoint[])
      : [];
  }
  if (Array.isArray(p.points)) return p.points;
  if (
    p.a != null &&
    p.b != null &&
    'x' in p.a &&
    'y' in p.a &&
    'x' in p.b &&
    'y' in p.b
  ) {
    return [p.a as CanvasPoint, p.b as CanvasPoint];
  }
  return [];
}

export function rotatePoint(
  point: CanvasPoint,
  center: CanvasPoint,
  angleDegrees: number,
): CanvasPoint {
  const angleRad = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  return {
    x: center.x + (point.x - center.x) * cos - (point.y - center.y) * sin,
    y: center.y + (point.x - center.x) * sin + (point.y - center.y) * cos,
  };
}
