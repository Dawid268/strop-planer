export interface EditorShape {
  id: string;
  type: string;
  points?: Array<{ x: number; y: number }>;
  x: number;
  y: number;
}

export interface EditorLayer {
  id: string;
  name: string;
  shapes: EditorShape[];
  isVisible: boolean;
  isLocked: boolean;
  opacity: number;
  color: string;
  type: string;
}

export interface EditorTab {
  id: string;
  name: string;
  active: boolean;
  layers: EditorLayer[];
}

export interface EditorData {
  tabs: EditorTab[];
}

export interface ExtractedPolygon {
  points: Array<{ x: number; y: number }>;
}

export interface ExtractedSlabGeometry {
  polygons: Array<ExtractedPolygon | Array<{ x: number; y: number }>>;
  bounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}
