/**
 * Editor Store - Helper functions
 * Pure utility functions for creating default tabs, layers, and generating IDs/colors.
 */
import type { EditorTab, EditorLayer } from '@models/project.model';

// ============================================================================
// ID Generation
// ============================================================================

/** Generate a unique ID with a prefix */
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Color Generation
// ============================================================================

const LAYER_COLORS = [
  '#e91e63',
  '#9c27b0',
  '#673ab7',
  '#3f51b5',
  '#2196f3',
  '#00bcd4',
  '#009688',
  '#4caf50',
  '#8bc34a',
  '#ff9800',
] as const;

export function generateLayerColor(): string {
  return LAYER_COLORS[Math.floor(Math.random() * LAYER_COLORS.length)];
}

// ============================================================================
// Factory Functions
// ============================================================================

/** Create a new layer with sensible defaults */
export function createDefaultLayer(
  name: string,
  type: EditorLayer['type'] = 'user',
): EditorLayer {
  const isCad = type === 'cad' || type === 'system';
  return {
    id: generateId('layer'),
    name,
    shapes: [],
    isVisible: true,
    isLocked: isCad,
    opacity: 1,
    type,
    color: isCad ? '#666666' : generateLayerColor(),
  };
}

/** Create a tab with CAD underlay + user layer (e.g. first tab from project) */
export function createDefaultTab(name: string): EditorTab {
  const cadLayer = createDefaultLayer('Podkład CAD', 'cad');
  const userLayer = createDefaultLayer('Warstwa 1', 'user');
  return {
    id: generateId('tab'),
    name,
    active: true,
    layers: [cadLayer, userLayer],
  };
}

/** Create an empty tab with a single user layer (no CAD underlay) */
export function createEmptyTab(name: string): EditorTab {
  const userLayer = createDefaultLayer('Warstwa 1', 'user');
  return {
    id: generateId('tab'),
    name,
    active: true,
    layers: [userLayer],
  };
}
