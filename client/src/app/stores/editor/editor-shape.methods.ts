/**
 * Editor Store - Shape CRUD methods
 * All operations related to creating, reading, updating, and deleting shapes.
 */
import { patchState } from '@ngrx/signals';
import { MessageService } from 'primeng/api';
import type { Shape, Point } from '@models/editor.models';
import type { EditorExtendedState, EditorStoreRef } from './editor.state';
import { generateId } from './editor.helpers';


// ============================================================================
// Helper: update shapes in the active tab's active layer
// ============================================================================

function patchActiveLayerShapes(
  store: EditorStoreRef,
  state: EditorExtendedState,
  updater: (shapes: Shape[]) => Shape[],
): EditorExtendedState['tabs'] {
  const activeTabId = store.activeTabId();
  const activeLayerId = store.activeLayerId();
  return state.tabs.map((t) =>
    t.id === activeTabId
      ? {
          ...t,
          layers: t.layers.map((l) =>
            l.id === activeLayerId
              ? { ...l, shapes: updater(l.shapes) }
              : l,
          ),
        }
      : t,
  );
}

function patchActiveTabShapes(
  activeTabId: string,
  state: EditorExtendedState,
  updater: (shapes: Shape[]) => Shape[],
): EditorExtendedState['tabs'] {
  return state.tabs.map((t) =>
    t.id === activeTabId
      ? {
          ...t,
          layers: t.layers.map((l) => ({
            ...l,
            shapes: updater(l.shapes),
          })),
        }
      : t,
  );
}

// ============================================================================
// Public API
// ============================================================================

export function createShapeMethods(
  store: EditorStoreRef,
  messageService: MessageService,
) {
  return {
    /** Create a slab shape from polygon points */
    createSlabFromPoints(points: Point[]): void {
      const activeTabId = store.activeTabId();
      const activeLayerId = store.activeLayerId();
      if (!activeTabId || !activeLayerId || points.length < 3) return;

      const newSlab: Shape = {
        id: generateId('slab'),
        type: 'slab',
        x: 0,
        y: 0,
        points: [...points],
        properties: {
          fill: 'rgba(33, 150, 243, 0.4)',
          stroke: '#1565c0',
          strokeWidth: 2,
          label: 'Strop (Zdefiniowany)',
        },
      };

      patchState(store, (state: EditorExtendedState) => ({
        tabs: patchActiveLayerShapes(store, state, (shapes) => [
          ...shapes,
          newSlab,
        ]),
        activePanel: 'properties' as const,
        selectedIds: [newSlab.id],
      }));

      messageService.add({
        severity: 'success',
        summary: 'Sukces',
        detail: 'Zdefiniowano nowy strop',
        life: 3000,
      });
    },

    /** Add a shape to the active layer */
    addShape(shape: Shape): void {
      if (!store.activeTabId() || !store.activeLayerId()) return;

      patchState(store, (state: EditorExtendedState) => ({
        tabs: patchActiveLayerShapes(store, state, (shapes) => [
          ...shapes,
          shape,
        ]),
        activePanel: 'properties' as const,
        selectedIds: [shape.id],
      }));
    },

    /** Update a shape's properties */
    updateShape(id: string, updates: Partial<Shape>): void {
      const activeTabId = store.activeTabId();
      if (!activeTabId) return;

      patchState(store, (state: EditorExtendedState) => ({
        tabs: patchActiveTabShapes(activeTabId, state, (shapes) =>
          shapes.map((s) =>
            s.id === id ? ({ ...s, ...updates } as Shape) : s,
          ),
        ),
      }));
    },

    /** Remove a single shape by ID */
    removeShape(id: string): void {
      const activeTabId = store.activeTabId();
      if (!activeTabId) return;

      patchState(store, (state: EditorExtendedState) => ({
        tabs: patchActiveTabShapes(activeTabId, state, (shapes) =>
          shapes.filter((s) => s.id !== id),
        ),
        selectedIds: store.selectedIds().filter((sid) => sid !== id),
      }));
    },

    /** Remove multiple shapes by IDs */
    removeShapes(ids: string[]): void {
      const activeTabId = store.activeTabId();
      if (!activeTabId || ids.length === 0) return;

      const idSet = new Set(ids);
      patchState(store, (state: EditorExtendedState) => ({
        tabs: patchActiveTabShapes(activeTabId, state, (shapes) =>
          shapes.filter((s) => !idSet.has(s.id)),
        ),
        selectedIds: state.selectedIds.filter((sid) => !idSet.has(sid)),
      }));
    },

    /** Remove all currently selected shapes */
    removeSelectedShapes(): void {
      const activeTabId = store.activeTabId();
      const selected = store.selectedIds();
      if (!activeTabId || selected.length === 0) return;

      const idSet = new Set(selected);
      patchState(store, (state: EditorExtendedState) => ({
        tabs: patchActiveTabShapes(activeTabId, state, (shapes) =>
          shapes.filter((s) => !idSet.has(s.id)),
        ),
        selectedIds: [],
      }));
    },
  };
}
