import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import { computed, inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import type { EditorTab, EditorLayer } from '@models/project.model';
import type { Shape } from '@models/editor.models';

// ============================================================================
// Helper Functions
// ============================================================================

function generateLayerColor(): string {
  const colors = [
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
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

function createDefaultLayer(
  name: string,
  type: EditorLayer['type'] = 'user',
): EditorLayer {
  const isCad = type === 'cad' || type === 'system';
  return {
    id: `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    shapes: [],
    isVisible: true,
    isLocked: isCad,
    opacity: 1,
    type,
    color: isCad ? '#666666' : generateLayerColor(),
  };
}

/** First tab (e.g. from project): has CAD underlay + user layer. */
export function createDefaultTab(name: string): EditorTab {
  const cadLayer = createDefaultLayer('Podkład CAD', 'cad');
  const userLayer = createDefaultLayer('Warstwa 1', 'user');

  return {
    id: `tab-${Date.now()}`,
    name,
    active: true,
    layers: [cadLayer, userLayer],
  };
}

/** New tab added by user: empty, single user layer (no CAD). */
export function createEmptyTab(name: string): EditorTab {
  const userLayer = createDefaultLayer('Warstwa 1', 'user');
  return {
    id: `tab-${Date.now()}`,
    name,
    active: true,
    layers: [userLayer],
  };
}

// ============================================================================
// State Interface
// ============================================================================

export interface EditorLayoutState {
  tabs: EditorTab[];
  activeTabId: string | null;
  activeLayerId: string | null;
}

const initialState: EditorLayoutState = {
  tabs: [],
  activeTabId: null,
  activeLayerId: null,
};

// ============================================================================
// Store Definition
// ============================================================================

export const EditorLayoutStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withDevtools('editorLayoutStore'),

  withComputed((state) => ({
    /** Currently active tab */
    activeTab: computed(() =>
      state.tabs().find((t) => t.id === state.activeTabId()),
    ),

    /** All layers in active tab */
    activeLayers: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      return tab?.layers ?? [];
    }),

    /** Currently active layer (user layer preferred) */
    activeLayer: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      if (!tab) return null;
      return (
        tab.layers.find((l) => l.id === state.activeLayerId()) ??
        tab.layers.find((l) => l.type === 'user') ??
        tab.layers[0] ??
        null
      );
    }),

    /** CAD layer in active tab (if exists) */
    cadLayer: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      return tab?.layers.find((l) => l.type === 'cad') ?? null;
    }),

    /** All shapes in active tab (across all layers) */
    allShapes: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      if (!tab) return [];
      return tab.layers.flatMap((l) => l.shapes);
    }),

    /** Visible shapes with layer metadata */
    visibleShapes: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      if (!tab) return [];

      return tab.layers
        .filter((l) => l.isVisible)
        .flatMap((l) =>
          l.shapes.map((s) => ({
            ...s,
            layerId: l.id,
            layerLocked: l.isLocked,
            opacity: l.opacity ?? 1,
          })),
        );
    }),

    /** All shapes with full layer metadata for canvas sync */
    tabShapesWithMetadata: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      if (!tab) return [];

      return tab.layers.flatMap((l) =>
        l.shapes.map((s) => ({
          ...s,
          layerId: l.id,
          isVisible: l.isVisible,
          isLocked: l.isLocked,
          opacity: l.opacity ?? 1,
        })),
      );
    }),

    /** Check if any slab/polygon is defined */
    isSlabDefined: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      if (!tab) return false;
      const allShapes = tab.layers.flatMap((l) => l.shapes);
      return allShapes.some((s) => s.type === 'polygon' || s.type === 'slab');
    }),

    /** All slab shapes */
    slabShapes: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      if (!tab) return [];
      return tab.layers
        .flatMap((l) => l.shapes)
        .filter((s) => s.type === 'slab');
    }),

    /** All panel shapes */
    panelShapes: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      if (!tab) return [];
      return tab.layers
        .flatMap((l) => l.shapes)
        .filter((s) => s.type === 'panel');
    }),
  })),

  withMethods((store) => {
    const messageService = inject(MessageService);

    return {
      // ========================================================================
      // Tab Management
      // ========================================================================

      addTab(name: string): string {
        const newTab = createEmptyTab(name);

        patchState(store, (state) => {
          const newTabs = [...state.tabs, newTab];
          return {
            tabs: newTabs.map((t) => ({ ...t, active: t.id === newTab.id })),
            activeTabId: newTab.id,
            activeLayerId: newTab.layers[0]?.id ?? null,
          };
        });

        return newTab.id;
      },

      removeTab(tabId: string): void {
        const tabs = store.tabs();
        if (tabs.length <= 1) {
          messageService.add({
            severity: 'warn',
            summary: 'Uwaga',
            detail: 'Nie można usunąć ostatniej strony',
            life: 3000,
          });
          return;
        }

        const tabIndex = tabs.findIndex((t) => t.id === tabId);
        const isActive = store.activeTabId() === tabId;

        patchState(store, (state) => {
          const newTabs = state.tabs.filter((t) => t.id !== tabId);
          let nextActiveTabId = state.activeTabId;
          let nextActiveLayerId = state.activeLayerId;

          if (isActive && newTabs.length > 0) {
            const newActiveTab =
              newTabs[Math.min(tabIndex, newTabs.length - 1)];
            nextActiveTabId = newActiveTab.id;
            nextActiveLayerId = newActiveTab.layers[0]?.id ?? null;
            newTabs.forEach((t) => (t.active = t.id === nextActiveTabId));
          }

          return {
            tabs: newTabs,
            activeTabId: nextActiveTabId,
            activeLayerId: nextActiveLayerId,
          };
        });
      },

      renameTab(tabId: string, newName: string): void {
        patchState(store, (state) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, name: newName } : t,
          ),
        }));
      },

      setActiveTab(tabId: string): void {
        const tab = store.tabs().find((t) => t.id === tabId);
        if (!tab) return;

        patchState(store, (state) => ({
          activeTabId: tabId,
          activeLayerId: tab.layers[0]?.id ?? null,
          tabs: state.tabs.map((t) => ({ ...t, active: t.id === tabId })),
        }));
      },

      setTabs(
        tabs: EditorTab[],
        activeTabId: string | null,
        activeLayerId: string | null,
      ): void {
        patchState(store, {
          tabs,
          activeTabId,
          activeLayerId,
        });
      },

      // ========================================================================
      // Layer Management
      // ========================================================================

      setActiveLayer(layerId: string): void {
        patchState(store, { activeLayerId: layerId });
      },

      toggleLayerVisibility(layerId: string): void {
        const activeTabId = store.activeTabId();
        if (!activeTabId) return;

        patchState(store, (state) => ({
          tabs: state.tabs.map((t) =>
            t.id === activeTabId
              ? {
                  ...t,
                  layers: t.layers.map((l) =>
                    l.id === layerId ? { ...l, isVisible: !l.isVisible } : l,
                  ),
                }
              : t,
          ),
        }));
      },

      toggleLayerLock(layerId: string): void {
        const activeTabId = store.activeTabId();
        if (!activeTabId) return;

        patchState(store, (state) => ({
          tabs: state.tabs.map((t) =>
            t.id === activeTabId
              ? {
                  ...t,
                  layers: t.layers.map((l) =>
                    l.id === layerId ? { ...l, isLocked: !l.isLocked } : l,
                  ),
                }
              : t,
          ),
        }));
      },

      setLayerOpacity(layerId: string, opacity: number): void {
        const activeTabId = store.activeTabId();
        if (!activeTabId) return;

        patchState(store, (state) => ({
          tabs: state.tabs.map((t) =>
            t.id === activeTabId
              ? {
                  ...t,
                  layers: t.layers.map((l) =>
                    l.id === layerId ? { ...l, opacity } : l,
                  ),
                }
              : t,
          ),
        }));
      },

      createLayerInActiveTab(
        name: string,
        type: EditorLayer['type'] = 'user',
      ): string | null {
        const activeTabId = store.activeTabId();
        if (!activeTabId) return null;

        const newLayer = createDefaultLayer(name, type);

        patchState(store, (state) => ({
          tabs: state.tabs.map((t) =>
            t.id === activeTabId
              ? { ...t, layers: [...t.layers, newLayer] }
              : t,
          ),
          activeLayerId: newLayer.id,
        }));

        return newLayer.id;
      },

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

        patchState(store, (state) => ({
          tabs: state.tabs.map((t) =>
            t.id === activeTabId
              ? {
                  ...t,
                  layers: t.layers.map((l) =>
                    l.id === layerId ? { ...l, name: newName } : l,
                  ),
                }
              : t,
          ),
        }));
      },

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

        patchState(store, (state) => {
          const updatedTabs = state.tabs.map((t) =>
            t.id === activeTabId
              ? { ...t, layers: t.layers.filter((l) => l.id !== layerId) }
              : t,
          );
          const remainingLayers =
            updatedTabs.find((t) => t.id === activeTabId)?.layers ?? [];

          return {
            tabs: updatedTabs,
            activeLayerId:
              currentActiveLayerId === layerId
                ? (remainingLayers[0]?.id ?? null)
                : currentActiveLayerId,
          };
        });

        messageService.add({
          severity: 'success',
          summary: 'Sukces',
          detail: `Warstwa "${layer.name}" została usunięta`,
          life: 3000,
        });
      },

      reorderLayers(layerId: string, newIndex: number): void {
        const activeTabId = store.activeTabId();
        if (!activeTabId) return;

        patchState(store, (state) => ({
          tabs: state.tabs.map((t) => {
            if (t.id !== activeTabId) return t;
            const layers = [...t.layers];
            const currentIndex = layers.findIndex((l) => l.id === layerId);
            if (
              currentIndex === -1 ||
              newIndex < 0 ||
              newIndex >= layers.length
            )
              return t;

            const [removed] = layers.splice(currentIndex, 1);
            layers.splice(newIndex, 0, removed);
            return { ...t, layers };
          }),
        }));
      },

      moveLayerToTab(layerId: string, targetTabId: string): void {
        const tabs = store.tabs();
        const activeTabId = store.activeTabId();
        if (!activeTabId || activeTabId === targetTabId) return;

        const sourceTab = tabs.find((t) => t.id === activeTabId);
        if (!sourceTab) return;

        const layerToMove = sourceTab.layers.find((l) => l.id === layerId);
        if (!layerToMove) return;

        const isFirstTab = tabs[0]?.id === sourceTab.id;
        if (layerToMove.type === 'cad' && isFirstTab) {
          messageService.add({
            severity: 'warn',
            summary: 'Nie można przenieść',
            detail:
              'Warstwy CAD nie można przenosić z pierwszej strony (rzut z CAD).',
            life: 4000,
          });
          return;
        }

        patchState(store, (state) => {
          const newTabs = state.tabs.map((t) => {
            if (t.id === activeTabId) {
              return {
                ...t,
                layers: t.layers.filter((l) => l.id !== layerId),
              };
            }
            if (t.id === targetTabId) {
              return {
                ...t,
                layers: [...t.layers, layerToMove],
              };
            }
            return t;
          });

          let nextActiveLayerId = state.activeLayerId;
          if (state.activeLayerId === layerId) {
            const updatedSourceTab = newTabs.find((t) => t.id === activeTabId);
            nextActiveLayerId = updatedSourceTab?.layers[0]?.id ?? null;
          }

          return {
            tabs: newTabs,
            activeLayerId: nextActiveLayerId,
          };
        });

        messageService.add({
          severity: 'success',
          summary: 'Przeniesiono warstwę',
          detail: `Warstwa "${layerToMove.name}" została przeniesiona.`,
          life: 3000,
        });
      },

      // ========================================================================
      // Shape Management (in layers)
      // ========================================================================

      addShapeToActiveLayer(shape: Shape): void {
        const activeTabId = store.activeTabId();
        const activeLayerId = store.activeLayerId();
        if (!activeTabId || !activeLayerId) return;

        patchState(store, (state) => ({
          tabs: state.tabs.map((t) =>
            t.id === activeTabId
              ? {
                  ...t,
                  layers: t.layers.map((l) =>
                    l.id === activeLayerId
                      ? { ...l, shapes: [...l.shapes, shape] }
                      : l,
                  ),
                }
              : t,
          ),
        }));
      },

      updateShapeInTab(shapeId: string, updates: Partial<Shape>): void {
        const activeTabId = store.activeTabId();
        if (!activeTabId) return;

        patchState(store, (state) => ({
          tabs: state.tabs.map((t) =>
            t.id === activeTabId
              ? {
                  ...t,
                  layers: t.layers.map((l) => ({
                    ...l,
                    shapes: l.shapes.map((s) =>
                      s.id === shapeId ? ({ ...s, ...updates } as Shape) : s,
                    ),
                  })),
                }
              : t,
          ),
        }));
      },

      removeShapeFromTab(shapeId: string): void {
        const activeTabId = store.activeTabId();
        if (!activeTabId) return;

        patchState(store, (state) => ({
          tabs: state.tabs.map((t) =>
            t.id === activeTabId
              ? {
                  ...t,
                  layers: t.layers.map((l) => ({
                    ...l,
                    shapes: l.shapes.filter((s) => s.id !== shapeId),
                  })),
                }
              : t,
          ),
        }));
      },

      removeShapesFromTab(shapeIds: string[]): void {
        const activeTabId = store.activeTabId();
        if (!activeTabId || shapeIds.length === 0) return;

        patchState(store, (state) => ({
          tabs: state.tabs.map((t) =>
            t.id === activeTabId
              ? {
                  ...t,
                  layers: t.layers.map((l) => ({
                    ...l,
                    shapes: l.shapes.filter((s) => !shapeIds.includes(s.id)),
                  })),
                }
              : t,
          ),
        }));
      },

      addShapesToActiveLayer(shapes: Shape[]): void {
        const activeTabId = store.activeTabId();
        const activeLayerId = store.activeLayerId();
        if (!activeTabId || !activeLayerId) return;

        patchState(store, (state) => ({
          tabs: state.tabs.map((t) =>
            t.id === activeTabId
              ? {
                  ...t,
                  layers: t.layers.map((l) =>
                    l.id === activeLayerId
                      ? { ...l, shapes: [...l.shapes, ...shapes] }
                      : l,
                  ),
                }
              : t,
          ),
        }));
      },

      saveSelectionAsLayer(layerName: string, selectedIds: string[]): void {
        const activeTabId = store.activeTabId();
        if (!activeTabId || selectedIds.length === 0) {
          messageService.add({
            severity: 'warn',
            summary: 'Uwaga',
            detail: 'Zaznacz elementy, które chcesz przenieść do nowej warstwy',
            life: 3000,
          });
          return;
        }

        const newLayer = createDefaultLayer(layerName, 'user');

        patchState(store, (state) => ({
          tabs: state.tabs.map((t) => {
            if (t.id !== activeTabId) return t;

            const shapesToMove: Shape[] = [];
            const updatedLayers = t.layers.map((l) => {
              const remaining: Shape[] = [];
              l.shapes.forEach((s) => {
                if (selectedIds.includes(s.id)) {
                  shapesToMove.push(s);
                } else {
                  remaining.push(s);
                }
              });
              return { ...l, shapes: remaining };
            });

            return {
              ...t,
              layers: [...updatedLayers, { ...newLayer, shapes: shapesToMove }],
            };
          }),
          activeLayerId: newLayer.id,
        }));

        messageService.add({
          severity: 'success',
          summary: 'Sukces',
          detail: `Utworzono warstwę "${layerName}" z ${selectedIds.length} elementami`,
          life: 3000,
        });
      },

      moveSelectionToLayer(targetLayerId: string, selectedIds: string[]): void {
        const activeTabId = store.activeTabId();
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

        patchState(store, (state) => ({
          tabs: state.tabs.map((t) => {
            if (t.id !== activeTabId) return t;

            const shapesToMove: Shape[] = [];
            const updatedLayers = t.layers.map((l) => {
              if (l.id === targetLayerId) return l;

              const remaining: Shape[] = [];
              l.shapes.forEach((s) => {
                if (selectedIds.includes(s.id)) {
                  shapesToMove.push(s);
                } else {
                  remaining.push(s);
                }
              });
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
        }));

        messageService.add({
          severity: 'success',
          summary: 'Sukces',
          detail: `Przeniesiono ${selectedIds.length} elementów do warstwy "${targetLayer.name}"`,
          life: 3000,
        });
      },

      clearAllShapesInTab(): void {
        const activeTabId = store.activeTabId();
        if (!activeTabId) return;

        patchState(store, (state) => ({
          tabs: state.tabs.map((t) =>
            t.id === activeTabId
              ? { ...t, layers: t.layers.map((l) => ({ ...l, shapes: [] })) }
              : t,
          ),
        }));
      },

      // ========================================================================
      // Reset
      // ========================================================================

      reset(): void {
        patchState(store, initialState);
      },
    };
  }),
);
