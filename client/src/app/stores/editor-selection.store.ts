import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import { computed } from '@angular/core';

// ============================================================================
// State Interface
// ============================================================================

export interface EditorSelectionState {
  selectedIds: string[];
}

const initialState: EditorSelectionState = {
  selectedIds: [],
};

// ============================================================================
// Store Definition
// ============================================================================

export const EditorSelectionStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withDevtools('editorSelectionStore'),

  withComputed((state) => ({
    /** Number of selected items */
    selectionCount: computed(() => state.selectedIds().length),

    /** Whether anything is selected */
    hasSelection: computed(() => state.selectedIds().length > 0),

    /** Whether multiple items are selected */
    hasMultipleSelection: computed(() => state.selectedIds().length > 1),
  })),

  withMethods((store) => ({
    // ========================================================================
    // Selection Operations
    // ========================================================================

    /** Select a single item, optionally adding to existing selection */
    select(id: string, addToSelection = false): void {
      if (addToSelection) {
        patchState(store, { selectedIds: [...store.selectedIds(), id] });
      } else {
        patchState(store, { selectedIds: [id] });
      }
    },

    /** Select multiple items (replaces current selection) */
    selectMultiple(ids: string[]): void {
      patchState(store, { selectedIds: ids });
    },

    /** Add items to current selection */
    addToSelection(ids: string[]): void {
      const current = store.selectedIds();
      const newIds = ids.filter((id) => !current.includes(id));
      patchState(store, { selectedIds: [...current, ...newIds] });
    },

    /** Remove items from current selection */
    removeFromSelection(ids: string[]): void {
      patchState(store, {
        selectedIds: store.selectedIds().filter((id) => !ids.includes(id)),
      });
    },

    /** Toggle selection of a single item */
    toggleSelection(id: string): void {
      const current = store.selectedIds();
      if (current.includes(id)) {
        patchState(store, {
          selectedIds: current.filter((sid) => sid !== id),
        });
      } else {
        patchState(store, { selectedIds: [...current, id] });
      }
    },

    /** Clear all selection */
    clearSelection(): void {
      patchState(store, { selectedIds: [] });
    },

    /** Check if an item is selected */
    isSelected(id: string): boolean {
      return store.selectedIds().includes(id);
    },

    // ========================================================================
    // Reset
    // ========================================================================

    reset(): void {
      patchState(store, initialState);
    },
  })),
);
