/**
 * Geometry Models
 * Used for canvas rendering and geometry processing
 */

/** 2D Point */
export interface GeometryPoint {
  x: number;
  y: number;
}

/** Shape types for geometry processing */
export type GeometryShapeType = 'polygon' | 'line' | 'circle' | 'rectangle';

/** Generic geometry shape */
export interface GeometryShape {
  /** Unique identifier */
  id: string;
  /** Shape type */
  type: GeometryShapeType;
  /** Points for polygons/polylines */
  points?: GeometryPoint[];
  /** X position */
  x?: number;
  /** Y position */
  y?: number;
  /** Width for rectangles */
  width?: number;
  /** Height for rectangles */
  height?: number;
  /** Radius for circles */
  radius?: number;
}

/** Raw geometry data from AI/PDF extraction */
export interface RawGeometry {
  /** Polygon arrays */
  polygons?: GeometryPoint[][];
  /** Line segments */
  lines?: Array<{ a: GeometryPoint; b: GeometryPoint }>;
}

/** Chunk data for progressive rendering */
export interface ChunkData {
  /** Chunk index */
  chunkIndex: number;
  /** Shapes in this chunk */
  shapes: GeometryShape[];
  /** Loading progress percentage */
  progress: number;
}

/** Worker message types for geometry processing */
export type WorkerMessageType = 'chunk' | 'progress' | 'complete' | 'error';

/** Worker progress data */
export interface WorkerProgressData {
  processed: number;
  total: number;
  message: string;
}

/** Worker complete data */
export interface WorkerCompleteData {
  totalShapes: number;
}

/** Worker message structure */
export interface WorkerMessage {
  type: WorkerMessageType;
  data?: ChunkData | WorkerProgressData | WorkerCompleteData;
  error?: string;
}
