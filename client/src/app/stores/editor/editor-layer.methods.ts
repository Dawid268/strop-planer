/**
 * Editor Store - Layer management methods
 * Create, delete, rename, toggle visibility/lock, opacity, move, reorder layers.
 */
import { patchState } from '@ngrx/signals';
import { MessageService } from 'primeng/api';
import type { Shape } from '@models/editor.models';
import type { EditorLayer } from '@models/project.model';
import type { EditorExtendedState, EditorStoreRef } from './editor.state';
import { createDefaultLayer } from './editor.helpers';


export function createLayerMethods(
  store: EditorStoreRef,
  messageService: MessageService,
) {
  // Helper: map layers in active tab
  function mapActiveTabLayers(
    state: EditorExtendedState,
    mapper: (layers: EditorLayer[]) => EditorLayer[],
  ): EditorExtendedState['tabs'] {
    const activeTabId = store.activeTabId();
    return state.tabs.map((t) =>
      t.id === activeTabId ? { ...t, layers: mapper(t.layers) } : t,
    );
  }

  return {
    /** Set the active layer */
    setActiveLayer(layerId: string): void {
      patchState(store, { activeLayerId: layerId });
    },

    /** Toggle layer visibility */
    toggleLayerVisibility(layerId: string): void {
      if (!store.activeTabId()) return;
      patchState(store, (state: EditorExtendedState) => ({
        tabs: mapActiveTabLayers(state, (layers) =>
          layers.map((l) =>
            l.id === layerId ? { ...l, isVisible: !l.isVisible } : l,
          ),
        ),
      }));
    },

    /** Toggle layer lock */
    toggleLayerLock(layerId: string): void {
      if (!store.activeTabId()) return;
      patchState(store, (state: EditorExtendedState) => ({
        tabs: mapActiveTabLayers(state, (layers) =>
          layers.map((l) =>
            l.id === layerId ? { ...l, isLocked: !l.isLocked } : l,
          ),
        ),
      }));
    },

    /** Set layer opacity (0-1) */
    setLayerOpacity(layerId: string, opacity: number): void {
      if (!store.activeTabId()) return;
      patchState(store, (state: EditorExtendedState) => ({
        tabs: mapActiveTabLayers(state, (layers) =>
          layers.map((l) => (l.id === layerId ? { ...l, opacity } : l)),
        ),
      }));
    },

    /** Create a new layer in the active tab */
    createLayerInActiveTab(
      name: string,
      type: EditorLayer['type'] = 'user',
    ): string | null {
      if (!store.activeTabId()) return null;

      const newLayer = createDefaultLayer(name, type);
      patchState(store, (state: EditorExtendedState) => ({
        tabs: mapActiveTabLayers(state, (layers) => [...layers, newLayer]),
        activeLayerId: newLayer.id,
      }));
      return newLayer.id;
    },

    /** Rename a layer (only user layers) */
    renameLayer(layerId: string, newName: string): void {
      const activeTabId = store.activeTabId();
      if (!activeTabId) return;

      const tab = store.tabs().find((t) => t.id === activeTabId);
      const layer = tab?.layers.find((l) => l.id === layerId);
      if (!layer || layer.type === 'system') {
        messageService.add({
          severity: 'warn',
          summary: 'Uwaga',
          detail: 'Nie można edytować tej warstwy',
          life: 3000,
        });
        return;
      }

      patchState(store, (state: EditorExtendedState) => ({
        tabs: mapActiveTabLayers(state, (layers) =>
          layers.map((l) =>
            l.id === layerId ? { ...l, name: newName } : l,
          ),
        ),
      }));
    },

    /** Delete a layer (only user/cad layers, not system) */
    deleteLayer(layerId: string): void {
      const activeTabId = store.activeTabId();
      if (!activeTabId) return;

      const tab = store.tabs().find((t) => t.id === activeTabId);
      const layer = tab?.layers.find((l) => l.id === layerId);
      if (!layer || layer.type === 'system') {
        messageService.add({
          severity: 'warn',
          summary: 'Uwaga',
          detail: 'Nie można usunąć tej warstwy',
          life: 3000,
        });
        return;
      }

      const currentActiveLayerId = store.activeLayerId();
      patchState(store, (state: EditorExtendedState) => {
        const updatedTabs = mapActiveTabLayers(state, (layers) =>
          layers.filter((l) => l.id !== layerId),
        );
        const remainingLayers =
          updatedTabs.find((t) => t.id === activeTabId)?.layers ?? [];

        return {
          tabs: updatedTabs,
          activeLayerId:
            currentActiveLayerId === layerId
              ? (remainingLayers[0]?.id ?? null)
              : currentActiveLayerId,
          selectedIds: [],
        };
      });

      messageService.add({
        severity: 'success',
        summary: 'Sukces',
        detail: `Warstwa "${layer.name}" została usunięta`,
        life: 3000,
      });
    },

    /** Save current selection as a new layer */
    saveSelectionAsLayer(layerName: string): void {
      const activeTabId = store.activeTabId();
      const selectedIds = store.selectedIds();
      if (!activeTabId || selectedIds.length === 0) {
        messageService.add({
          severity: 'warn',
          summary: 'Uwaga',
          detail: 'Zaznacz elementy, które chcesz przenieść do nowej warstwy',
          life: 3000,
        });
        return;
      }

      const idSet = new Set(selectedIds);
      const newLayer = createDefaultLayer(layerName, 'user');

      patchState(store, (state: EditorExtendedState) => ({
        tabs: state.tabs.map((t) => {
          if (t.id !== activeTabId) return t;

          const shapesToMove: Shape[] = [];
          const updatedLayers = t.layers.map((l) => {
            const remaining: Shape[] = [];
            for (const s of l.shapes) {
              if (idSet.has(s.id)) shapesToMove.push(s);
              else remaining.push(s);
            }
            return { ...l, shapes: remaining };
          });

          return {
            ...t,
            layers: [
              ...updatedLayers,
              { ...newLayer, shapes: shapesToMove },
            ],
          };
        }),
        activeLayerId: newLayer.id,
        selectedIds: [],
      }));

      messageService.add({
        severity: 'success',
        summary: 'Sukces',
        detail: `Utworzono warstwę "${layerName}" z ${selectedIds.length} elementami`,
        life: 3000,
      });
    },

    /** Move selected shapes to an existing layer */
    moveSelectionToLayer(targetLayerId: string): void {
      const activeTabId = store.activeTabId();
      const selectedIds = store.selectedIds();
      if (!activeTabId || selectedIds.length === 0) {
        messageService.add({
          severity: 'warn',
          summary: 'Uwaga',
          detail: 'Zaznacz elementy, które chcesz przenieść',
          life: 3000,
        });
        return;
      }

      const tab = store.tabs().find((t) => t.id === activeTabId);
      const targetLayer = tab?.layers.find((l) => l.id === targetLayerId);
      if (!targetLayer) return;

      const idSet = new Set(selectedIds);
      patchState(store, (state: EditorExtendedState) => ({
        tabs: state.tabs.map((t) => {
          if (t.id !== activeTabId) return t;

          const shapesToMove: Shape[] = [];
          const updatedLayers = t.layers.map((l) => {
            if (l.id === targetLayerId) return l;
            const remaining: Shape[] = [];
            for (const s of l.shapes) {
              if (idSet.has(s.id)) shapesToMove.push(s);
              else remaining.push(s);
            }
            return { ...l, shapes: remaining };
          });

          return {
            ...t,
            layers: updatedLayers.map((l) =>
              l.id === targetLayerId
                ? { ...l, shapes: [...l.shapes, ...shapesToMove] }
                : l,
            ),
          };
        }),
        selectedIds: [],
      }));

      messageService.add({
        severity: 'success',
        summary: 'Sukces',
        detail: `Przeniesiono ${selectedIds.length} elementów do warstwy "${targetLayer.name}"`,
        life: 3000,
      });
    },

    /** Reorder layers within the active tab */
    reorderLayers(layerId: string, newIndex: number): void {
      if (!store.activeTabId()) return;

      patchState(store, (state: EditorExtendedState) => ({
        tabs: mapActiveTabLayers(state, (layers) => {
          const arr = [...layers];
          const currentIndex = arr.findIndex((l) => l.id === layerId);
          if (
            currentIndex === -1 ||
            newIndex < 0 ||
            newIndex >= arr.length
          )
            return layers;

          const [removed] = arr.splice(currentIndex, 1);
          arr.splice(newIndex, 0, removed);
          return arr;
        }),
      }));
    },
  };
}
