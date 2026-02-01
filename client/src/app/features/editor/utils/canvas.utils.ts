import * as fabric from 'fabric';

export interface CustomFabricObject extends fabric.FabricObject {
  customData?: {
    id?: string;
    isGrid?: boolean;
    isFromSvg?: boolean;
    isFromGeometry?: boolean;
    type?: string;
    layerId?: string;
    chunkId?: string;
  };
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
