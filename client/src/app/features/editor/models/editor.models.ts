export type LayerType = "slab" | "beams" | "formwork" | "annotations";

export interface LayerState {
  name: LayerType;
  visible: boolean;
  locked: boolean;
  opacity: number;
}

export type EditorTool = ToolType;

export type ToolType =
  | "select"
  | "pan"
  | "add-panel"
  | "add-prop"
  | "draw-beam"
  | "draw-polygon" // Added for tracing
  | "rectangle";

export interface Point {
  x: number;
  y: number;
}

export interface Shape {
  id: string;
  type: "slab" | "beam" | "panel" | "prop" | "polygon" | "rectangle";
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
  type: "panel";
  width: number;
  length: number;
  catalogCode: string;
  manufacturer: string;
  system: string;
}

export interface BeamShape extends Shape {
  type: "beam";
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
  type: "panel" | "prop";
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
}

export const DEFAULT_COLORS = {
  slab: { fill: "#eeeeee", stroke: "#9e9e9e" },
  beam: { stroke: "#ffeb3b" },
  panel: { fill: "#ffebee", stroke: "#d32f2f" },
  prop: { fill: "#e3f2fd", stroke: "#1976d2" },
};
