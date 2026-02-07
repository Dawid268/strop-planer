/**
 * CAD/DXF Data Interfaces
 * Used for rendering CAD entities from DXF files on the canvas
 */

/** Supported CAD entity types */
export type CadEntityType = 'line' | 'circle' | 'polyline' | 'text';

/** Represents a single CAD entity from DXF parsing */
export interface CadEntity {
  /** Entity type */
  type: CadEntityType;
  /** Layer name from DXF */
  layer?: string;
  /** Stroke color */
  stroke?: string;

  // Line specific properties
  /** Start X coordinate for lines */
  x1?: number;
  /** Start Y coordinate for lines */
  y1?: number;
  /** End X coordinate for lines */
  x2?: number;
  /** End Y coordinate for lines */
  y2?: number;

  // Circle specific properties
  /** Center X coordinate for circles */
  left?: number;
  /** Center Y coordinate for circles */
  top?: number;
  /** Radius for circles */
  radius?: number;

  // Text specific properties
  /** Text content */
  text?: string;
  /** Font size */
  fontSize?: number;
  /** Fill color for text */
  fill?: string;
}

/** Map of layer names to their entities */
export interface CadLayerData {
  [layerName: string]: CadEntity[];
}

/** Metadata from CAD conversion */
export interface CadMetadata {
  entityCount: number;
  convertedCount: number;
}

/** Complete CAD data structure from DXF parsing */
export interface CadData {
  /** Conversion metadata (from API) */
  metadata?: CadMetadata;
  /** Entities grouped by layer */
  layers?: CadLayerData;
  /** Flat list of entities */
  entities?: CadEntity[];
  /** Bounding box of all entities */
  bounds: CadBounds;
}

/** Bounding box for CAD data */
export interface CadBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** State for CAD layer rendering */
export interface CadLayerState {
  visible?: boolean;
  opacity?: number;
  locked?: boolean;
}
