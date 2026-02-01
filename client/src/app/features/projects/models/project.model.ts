import { Shape } from "../../editor/models/editor.models";

export interface EditorLayer {
  id: string;
  name: string;
  shapes: Shape[];
  isVisible: boolean;
  isLocked: boolean;
  opacity: number;
  color?: string;
  type?: "ai_vectors" | "user" | "system";
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
  status: "draft" | "calculated" | "optimized" | "sent" | "completed";
  slabLength: number;
  slabWidth: number;
  slabThickness: number;
  floorHeight: number;
  slabType: string;
  slabArea: number;
  formworkSystem?: string;
  calculationResult?: any;
  optimizationResult?: any;
  sourcePdfPath?: string;
  dxfPath?: string;
  geoJsonPath?: string;
  svgPath?: string;
  extractedPdfData?: any;
  extractedSlabGeometry?: any;
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
  status?: Project["status"];
  slabLength?: number;
  slabWidth?: number;
  slabThickness?: number;
  floorHeight?: number;
  slabType?: string;
  formworkSystem?: string;
  optimizationResult?: any;
  extractedSlabGeometry?: string;
}

export interface ProjectStats {
  totalProjects: number;
  draftCount: number;
  completedCount: number;
  totalArea: number;
}

export interface Job {
  id: string;
  status: "pending" | "processing" | "completed" | "failed";
  message: string;
  result?: any;
  error?: string;
  createdAt: string;
}
