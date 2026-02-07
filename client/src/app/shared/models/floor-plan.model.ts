/**
 * DXF Entity types
 */
export interface DxfEntity {
  type: 'LINE' | 'POLYLINE' | 'CIRCLE' | 'ARC' | 'TEXT' | string;
  layer: string;
  vertices?: Array<{ x: number; y: number }>;
  center?: { x: number; y: number };
  radius?: number;
  startPoint?: { x: number; y: number };
  endPoint?: { x: number; y: number };
  text?: string;
}

/**
 * Bounds for DXF data
 */
export interface DxfBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Parsed DXF data structure
 */
export interface DxfData {
  entities: DxfEntity[];
  layers: string[];
  bounds: DxfBounds;
}

/**
 * Document response from API
 */
export interface FloorPlanDocument {
  documentId: string;
  data: DxfData;
}

/**
 * Selected entity from viewer
 */
export interface SelectedEntity {
  id: string;
  userData: Record<string, unknown>;
  points: Array<{ x: number; y: number }>;
}

/**
 * Floor plan state for store
 */
export interface FloorPlanState {
  document: FloorPlanDocument | null;
  visibleLayers: Set<string>;
  selectedEntity: SelectedEntity | null;
  showGrid: boolean;
  isSelectionMode: boolean;
}
