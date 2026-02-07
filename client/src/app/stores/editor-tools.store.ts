import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import type { EditorTool, CatalogItem, ViewMode } from '@models/editor.models';

// ============================================================================
// State Interface
// ============================================================================

export interface EditorToolsState {
  activeTool: EditorTool;
  activeCatalogItem: CatalogItem | null;
  viewMode: ViewMode;
}

const initialState: EditorToolsState = {
  activeTool: 'select',
  activeCatalogItem: null,
  viewMode: 'full',
};

// ============================================================================
// Store Definition
// ============================================================================

export const EditorToolsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withDevtools('editorToolsStore'),

  withMethods((store) => ({
    // ========================================================================
    // Tool Selection
    // ========================================================================

    setActiveTool(tool: EditorTool): void {
      patchState(store, { activeTool: tool, activeCatalogItem: null });
    },

    setActiveCatalogItem(item: CatalogItem | null): void {
      patchState(store, {
        activeCatalogItem: item,
        activeTool: item ? 'add-panel' : 'select',
      });
    },

    // ========================================================================
    // View Mode
    // ========================================================================

    setViewMode(mode: ViewMode): void {
      patchState(store, { viewMode: mode });
    },

    toggleViewMode(): void {
      const newMode: ViewMode = store.viewMode() === 'full' ? 'slab' : 'full';
      patchState(store, { viewMode: newMode });
    },

    // ========================================================================
    // Reset
    // ========================================================================

    reset(): void {
      patchState(store, initialState);
    },
  })),
);
