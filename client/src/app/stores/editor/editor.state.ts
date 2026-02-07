/**
 * Editor Store - State definition
 * Single source of truth for the EditorExtendedState interface and initial values.
 */
import type { WritableStateSource } from '@ngrx/signals';
import type { EditorTool, CatalogItem, ViewMode, Shape } from '@models/editor.models';
import type { EditorTab } from '@models/project.model';

export type SidebarPanel = 'tabs' | 'layers' | 'properties' | 'catalog';

export interface EditorExtendedState {
  /** All editor tabs (pages) */
  tabs: EditorTab[];
  /** Currently active tab ID */
  activeTabId: string | null;
  /** Currently active layer ID within the active tab */
  activeLayerId: string | null;
  /** IDs of selected shapes */
  selectedIds: string[];

  // -- Viewport --
  zoom: number;
  panX: number;
  panY: number;

  // -- Grid --
  gridSize: number;
  snapToGrid: boolean;
  showGrid: boolean;

  // -- Tools --
  activeTool: EditorTool;
  activeCatalogItem: CatalogItem | null;

  // -- Background & Geometry --
  backgroundUrl: string | null;
  referenceGeometry: unknown | null;

  // -- View --
  viewMode: ViewMode;

  // -- Project --
  projectId: string | null;
  geoJsonPath: string | null;
  dxfPath: string | null;

  // -- Sidebar --
  activePanel: SidebarPanel;
}

/**
 * Store reference type used by method factory functions.
 * Combines WritableStateSource (needed by patchState) with signal accessors.
 */
export type EditorStoreRef = WritableStateSource<object> & {
  tabs: () => EditorTab[];
  activeTabId: () => string | null;
  activeLayerId: () => string | null;
  selectedIds: () => string[];
  zoom: () => number;
  panX: () => number;
  panY: () => number;
  gridSize: () => number;
  snapToGrid: () => boolean;
  showGrid: () => boolean;
  activeTool: () => EditorTool;
  activeCatalogItem: () => CatalogItem | null;
  backgroundUrl: () => string | null;
  referenceGeometry: () => unknown | null;
  viewMode: () => ViewMode;
  projectId: () => string | null;
  geoJsonPath: () => string | null;
  dxfPath: () => string | null;
  activePanel: () => SidebarPanel;
  // Computed signals
  allShapes: () => Shape[];
  activeTab: () => EditorTab | undefined;
  activeLayer: () => unknown | null;
};

export const initialEditorState: EditorExtendedState = {
  tabs: [],
  activeTabId: null,
  activeLayerId: null,
  selectedIds: [],
  zoom: 1,
  panX: 0,
  panY: 0,
  gridSize: 100,
  snapToGrid: true,
  showGrid: true,
  activeTool: 'select',
  activeCatalogItem: null,
  backgroundUrl: null,
  referenceGeometry: null,
  viewMode: 'full',
  projectId: null,
  geoJsonPath: null,
  dxfPath: null,
  activePanel: 'tabs',
};
