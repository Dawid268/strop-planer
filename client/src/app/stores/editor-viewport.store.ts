import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import {
  withDevtools,
  withStorageSync,
} from '@angular-architects/ngrx-toolkit';
import type { Point } from '@models/editor.models';

// ============================================================================
// State Interface
// ============================================================================

export interface EditorViewportState {
  zoom: number;
  panX: number;
  panY: number;
  gridSize: number;
  snapToGrid: boolean;
  showGrid: boolean;
}

const initialState: EditorViewportState = {
  zoom: 1,
  panX: 0,
  panY: 0,
  gridSize: 100,
  snapToGrid: true,
  showGrid: true,
};

// ============================================================================
// Constants
// ============================================================================

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;

// ============================================================================
// Store Definition
// ============================================================================

export const EditorViewportStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withStorageSync({
    key: 'editorViewportState',
    select: (state: EditorViewportState) => ({
      gridSize: state.gridSize,
      snapToGrid: state.snapToGrid,
      showGrid: state.showGrid,
    }),
  }),
  withDevtools('editorViewportStore'),

  withMethods((store) => ({
    // ========================================================================
    // Zoom
    // ========================================================================

    setZoom(zoom: number): void {
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
      patchState(store, { zoom: clampedZoom });
    },

    zoomIn(): void {
      const newZoom = Math.min(MAX_ZOOM, store.zoom() * 1.2);
      patchState(store, { zoom: newZoom });
    },

    zoomOut(): void {
      const newZoom = Math.max(MIN_ZOOM, store.zoom() / 1.2);
      patchState(store, { zoom: newZoom });
    },

    // ========================================================================
    // Pan
    // ========================================================================

    setPan(x: number, y: number): void {
      patchState(store, { panX: x, panY: y });
    },

    panBy(delta: Point): void {
      patchState(store, (state) => ({
        panX: state.panX + delta.x,
        panY: state.panY + delta.y,
      }));
    },

    // ========================================================================
    // View Reset
    // ========================================================================

    resetView(): void {
      patchState(store, { zoom: 1, panX: 0, panY: 0 });
    },

    // ========================================================================
    // Grid
    // ========================================================================

    toggleSnapToGrid(): void {
      patchState(store, { snapToGrid: !store.snapToGrid() });
    },

    toggleGrid(): void {
      patchState(store, { showGrid: !store.showGrid() });
    },

    setGridSize(size: number): void {
      patchState(store, { gridSize: size });
    },

    setSnapToGrid(enabled: boolean): void {
      patchState(store, { snapToGrid: enabled });
    },

    setShowGrid(show: boolean): void {
      patchState(store, { showGrid: show });
    },

    // ========================================================================
    // Snap Helpers
    // ========================================================================

    snapToGridPoint(point: Point): Point {
      if (!store.snapToGrid()) return point;
      const grid = store.gridSize();
      return {
        x: Math.round(point.x / grid) * grid,
        y: Math.round(point.y / grid) * grid,
      };
    },

    // ========================================================================
    // Reset
    // ========================================================================

    reset(): void {
      patchState(store, initialState);
    },
  })),
);
