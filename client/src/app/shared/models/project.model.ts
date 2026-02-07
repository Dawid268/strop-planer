import { Shape } from './editor.models';

export interface EditorLayer {
  id: string;
  name: string;
  shapes: Shape[];
  isVisible: boolean;
  isLocked: boolean;
  opacity: number;
  color?: string;
  type: 'cad' | 'user' | 'system';
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

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'calculated' | 'optimized' | 'sent' | 'completed';
  slabLength: number;
  slabWidth: number;
  slabThickness: number;
  floorHeight: number;
  slabType: string;
  slabArea: number;
  formworkSystem?: string;
  calculationResult?: Record<string, unknown>;
  optimizationResult?: Record<string, unknown>;
  sourcePdfPath?: string;
  dxfPath?: string;
  geoJsonPath?: string;
  svgPath?: string;
  extractedPdfData?: Record<string, unknown>;
  extractedSlabGeometry?: Record<string, unknown>;
  editorData?: EditorData;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
  slabLength: number;
  slabWidth: number;
  slabThickness: number;
  floorHeight: number;
  slabType?: string;
  formworkSystem?: string;
  sourcePdfPath?: string;
  dxfPath?: string;
  geoJsonPath?: string;
  svgPath?: string;
  extractedPdfData?: string;
  extractedSlabGeometry?: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  status?: Project['status'];
  slabLength?: number;
  slabWidth?: number;
  slabThickness?: number;
  floorHeight?: number;
  slabType?: string;
  formworkSystem?: string;
  optimizationResult?: Record<string, unknown>;
  extractedSlabGeometry?: string;
  sourcePdfPath?: string;
  dxfPath?: string;
  geoJsonPath?: string;
}

export interface ProjectStats {
  totalProjects: number;
  draftCount: number;
  completedCount: number;
  totalArea: number;
}
