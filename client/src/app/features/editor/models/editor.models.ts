/** Default layer names - can be extended with user-created layers */
export type DefaultLayerName = 'slab' | 'beams' | 'formwork' | 'annotations';

/** Layer category determines permissions and behavior */
export type LayerCategory = 'system' | 'data' | 'user';

export interface LayerState {
  /** Unique identifier for the layer */
  id: string;
  /** Display name (can be edited for user layers) */
  name: string;
  /** Category determines layer behavior */
  category: LayerCategory;
  /** Whether the layer is visible on canvas */
  visible: boolean;
  /** Whether shapes on this layer can be edited */
  locked: boolean;
  /** Layer opacity (0-1) */
  opacity: number;
  /** Whether the layer can be edited (name change) */
  isEditable: boolean;
  /** Whether the layer can be deleted */
  isRemovable: boolean;
  /** Optional color for layer badge in UI */
  color?: string;
}

/** Backward compatibility type alias - now accepts any layer ID string */
export type LayerType = string;

export type EditorTool = ToolType;

export type ToolType =
  | 'select'
  | 'pan'
  | 'add-panel'
  | 'add-prop'
  | 'draw-beam'
  | 'draw-polygon'
  | 'trace-slab'
  | 'rectangle';

export interface Point {
  x: number;
  y: number;
}

export interface Shape {
  id: string;
  type: 'slab' | 'beam' | 'panel' | 'prop' | 'polygon' | 'rectangle';
  x: number;
  y: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  selected?: boolean;
  locked?: boolean;
  layer?: LayerType;
  // Specific properties
  points?: Point[]; // For polygons
  width?: number; // For rectangles/panels
  height?: number;
  properties?: any; // Generic bag for colors, labels
  catalogCode?: string; // For panels/props
}

export interface PanelShape extends Shape {
  type: 'panel';
  width: number;
  length: number;
  catalogCode: string;
  manufacturer: string;
  system: string;
}

export interface BeamShape extends Shape {
  type: 'beam';
  endX: number;
  endY: number;
}

export interface CatalogItem {
  code: string;
  name: string;
  width: number;
  length: number;
  manufacturer: string;
  system: string;
  type: 'panel' | 'prop';
}

export interface EditorState {
  shapes: Shape[];
  layers: LayerState[];
  selectedIds: string[];
  zoom: number;
  panX: number;
  panY: number;
  gridSize: number;
  snapToGrid: boolean;
  showGrid: boolean;
  activeTool: ToolType;
  activeCatalogItem: CatalogItem | null;
  backgroundUrl?: string | null;
  referenceGeometry?: any | null; // Data for snapping
  viewMode: ViewMode;
  projectId: string | null;
  /** ID of the currently active layer */
  activeLayerId: string;
}

export type ViewMode = 'full' | 'slab';

export const DEFAULT_COLORS = {
  slab: { fill: '#eeeeee', stroke: '#9e9e9e' },
  beam: { stroke: '#ffeb3b' },
  panel: { fill: '#ffebee', stroke: '#d32f2f' },
  prop: { fill: '#e3f2fd', stroke: '#1976d2' },
};
