import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from "@ngrx/signals";
import {
  withDevtools,
  withCallState,
  withStorageSync,
  setLoading,
  setLoaded,
  setError,
} from "@angular-architects/ngrx-toolkit";
import { computed, inject } from "@angular/core";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { pipe } from "rxjs";
import { tap, switchMap, map, catchError } from "rxjs/operators";
import { MessageService } from "primeng/api";

import { FormworkApiService } from "@api/formwork-api.service";
import { ProjectsApiService } from "@api/projects-api.service";
import type {
  Shape,
  ShapeProperties,
  EditorTool,
  Point,
  CatalogItem,
  ViewMode,
} from "@models/editor.models";
import type { FormworkLayout } from "@models/formwork.models";
import { isPanelDetails } from "@models/formwork.models";
import { EditorData, EditorTab, EditorLayer } from "@models/project.model";
import { getPolygonPoints } from "@utils/canvas.utils";

function createDefaultLayer(
  name: string,
  type: EditorLayer["type"] = "user",
): EditorLayer {
  const isCad = type === "cad" || type === "system";
  return {
    id: `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    shapes: [],
    isVisible: true,
    isLocked: isCad,
    opacity: 1,
    type,
    color: isCad ? "#666666" : generateLayerColor(),
  };
}

/** First tab (e.g. from project): has CAD underlay + user layer. */
function createDefaultTab(name: string): EditorTab {
  const cadLayer = createDefaultLayer("Podkład CAD", "cad");
  const userLayer = createDefaultLayer("Warstwa 1", "user");

  return {
    id: `tab-${Date.now()}`,
    name,
    active: true,
    layers: [cadLayer, userLayer],
  };
}

/** New tab added by user: empty, single user layer (no CAD). */
function createEmptyTab(name: string): EditorTab {
  const userLayer = createDefaultLayer("Warstwa 1", "user");
  return {
    id: `tab-${Date.now()}`,
    name,
    active: true,
    layers: [userLayer],
  };
}

function generateLayerColor(): string {
  const colors = [
    "#e91e63",
    "#9c27b0",
    "#673ab7",
    "#3f51b5",
    "#2196f3",
    "#00bcd4",
    "#009688",
    "#4caf50",
    "#8bc34a",
    "#ff9800",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

export interface EditorExtendedState {
  tabs: EditorTab[];
  activeTabId: string | null;
  activeLayerId: string | null;
  selectedIds: string[];
  zoom: number;
  panX: number;
  panY: number;
  gridSize: number;
  snapToGrid: boolean;
  showGrid: boolean;
  activeTool: EditorTool;
  activeCatalogItem: CatalogItem | null;
  backgroundUrl: string | null;
  referenceGeometry: unknown | null;
  viewMode: ViewMode;
  projectId: string | null;
  /** Path to GeoJSON (e.g. /uploads/xxx.json) – used for DXF viewer / import podkładu */
  geoJsonPath: string | null;
  /** Path to DXF (e.g. /uploads/xxx.dxf) */
  dxfPath: string | null;
  /** Active sidebar panel */
  activePanel: "tabs" | "layers" | "properties" | "catalog";
}

const initialState: EditorExtendedState = {
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
  activeTool: "select",
  activeCatalogItem: null,
  backgroundUrl: null,
  referenceGeometry: null,
  viewMode: "full",
  projectId: null,
  geoJsonPath: null,
  dxfPath: null,
  activePanel: "tabs",
};

export const EditorStore = signalStore(
  { providedIn: "root" },
  withState(initialState),
  withStorageSync({
    key: "editorState",
    select: (state: EditorExtendedState) => ({
      gridSize: state.gridSize,
      snapToGrid: state.snapToGrid,
      showGrid: state.showGrid,
      viewMode: state.viewMode,
    }),
  }),
  withDevtools("editorStore"),
  withCallState(),
  withComputed((state) => ({
    activeTab: computed(() =>
      state.tabs().find((t) => t.id === state.activeTabId()),
    ),
    activeLayers: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      return tab?.layers ?? [];
    }),
    activeLayer: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      if (!tab) return null;
      return (
        tab.layers.find((l) => l.id === state.activeLayerId()) ??
        tab.layers.find((l) => l.type === "user") ??
        tab.layers[0] ??
        null
      );
    }),
    cadLayer: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      return tab?.layers.find((l) => l.type === "cad") ?? null;
    }),
    allShapes: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      if (!tab) return [];
      return tab.layers.flatMap((l) => l.shapes);
    }),
    selectedShapes: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      if (!tab) return [];
      const allShapes = tab.layers.flatMap((l) => l.shapes);
      return allShapes.filter((s) => state.selectedIds().includes(s.id));
    }),
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
    /**
     * All shapes in current tab with metadata about their layer (visibility, lock, opacity).
     * Used for efficient canvas synchronization (Object pooling/visibility toggling).
     */
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
    isSlabDefined: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      if (!tab) return false;
      const allShapes = tab.layers.flatMap((l) => l.shapes);
      return allShapes.some((s) => s.type === "polygon" || s.type === "slab");
    }),
    slabShapes: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      if (!tab) return [];
      return tab.layers
        .flatMap((l) => l.shapes)
        .filter((s) => s.type === "slab");
    }),
    panelShapes: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      if (!tab) return [];
      return tab.layers
        .flatMap((l) => l.shapes)
        .filter((s) => s.type === "panel");
    }),
  })),

  withMethods((store) => {
    const formworkApi = inject(FormworkApiService);
    const projectsApi = inject(ProjectsApiService);
    const messageService = inject(MessageService);

    return {
      // Geometry transformation
      createSlabFromPoints(points: Point[]): void {
        const activeTabId = store.activeTabId();
        const activeLayerId = store.activeLayerId();
        if (!activeTabId || !activeLayerId || points.length < 3) return;

        // Ensure closure for polygon data consistency
        const cleanedPoints = [...points];

        const newSlab: Shape = {
          id: `slab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: "slab",
          x: 0,
          y: 0,
          points: cleanedPoints,
          properties: {
            fill: "rgba(33, 150, 243, 0.4)",
            stroke: "#1565c0",
            strokeWidth: 2,
            label: "Strop (Zdefiniowany)",
          },
        };

        patchState(store, (state: EditorExtendedState) => ({
          tabs: state.tabs.map((t) =>
            t.id === activeTabId
              ? {
                  ...t,
                  layers: t.layers.map((l) =>
                    l.id === activeLayerId
                      ? { ...l, shapes: [...l.shapes, newSlab] }
                      : l,
                  ),
                }
              : t,
          ),
          activePanel: "properties" as const, // Auto-open properties as per UI design
          selectedIds: [newSlab.id],
        }));

        messageService.add({
          severity: "success",
          summary: "Sukces",
          detail: "Zdefiniowano nowy strop",
          life: 3000,
        });
      },

      removeShapes(ids: string[]): void {
        const activeTabId = store.activeTabId();
        if (!activeTabId || ids.length === 0) return;

        patchState(store, (state: EditorExtendedState) => ({
          tabs: state.tabs.map((t) =>
            t.id === activeTabId
              ? {
                  ...t,
                  layers: t.layers.map((l) => ({
                    ...l,
                    shapes: l.shapes.filter((s) => !ids.includes(s.id)),
                  })),
                }
              : t,
          ),
          selectedIds: state.selectedIds.filter((sid) => !ids.includes(sid)),
        }));
      },

      // Shape CRUD
      addShape(shape: Shape): void {
        const activeTabId = store.activeTabId();
        const activeLayerId = store.activeLayerId();
        if (!activeTabId || !activeLayerId) {
          // Guard clause: no active tab or layer - silently return
          return;
        }

        patchState(store, (state: EditorExtendedState) => ({
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
          activePanel: "properties" as const,
          selectedIds: [shape.id],
        }));
      },

      updateShape(id: string, updates: Partial<Shape>): void {
        const activeTabId = store.activeTabId();
        if (!activeTabId) return;

        patchState(store, (state: EditorExtendedState) => ({
          tabs: state.tabs.map((t) =>
            t.id === activeTabId
              ? {
                  ...t,
                  layers: t.layers.map((l) => ({
                    ...l,
                    shapes: l.shapes.map((s) =>
                      s.id === id ? ({ ...s, ...updates } as Shape) : s,
                    ),
                  })),
                }
              : t,
          ),
        }));
      },

      removeShape(id: string): void {
        const activeTabId = store.activeTabId();
        if (!activeTabId) return;

        const currentSelectedIds = store.selectedIds();
        patchState(store, (state: EditorExtendedState) => ({
          tabs: state.tabs.map((t) =>
            t.id === activeTabId
              ? {
                  ...t,
                  layers: t.layers.map((l) => ({
                    ...l,
                    shapes: l.shapes.filter((s) => s.id !== id),
                  })),
                }
              : t,
          ),
          selectedIds: currentSelectedIds.filter((sid) => sid !== id),
        }));
      },

      removeSelectedShapes(): void {
        const activeTabId = store.activeTabId();
        const selected = store.selectedIds();
        if (!activeTabId || selected.length === 0) return;

        patchState(store, (state: EditorExtendedState) => ({
          tabs: state.tabs.map((t) =>
            t.id === activeTabId
              ? {
                  ...t,
                  layers: t.layers.map((l) => ({
                    ...l,
                    shapes: l.shapes.filter((s) => !selected.includes(s.id)),
                  })),
                }
              : t,
          ),
          selectedIds: [],
        }));
      },

      // Selection
      select(id: string, addToSelection = false): void {
        if (addToSelection) {
          patchState(store, { selectedIds: [...store.selectedIds(), id] });
        } else {
          patchState(store, { selectedIds: [id] });
        }
      },

      selectMultiple(ids: string[]): void {
        patchState(store, { selectedIds: ids });
      },

      clearSelection(): void {
        patchState(store, { selectedIds: [] });
      },

      // Viewport
      setZoom(zoom: number): void {
        patchState(store, { zoom: Math.max(0.1, Math.min(5, zoom)) });
      },

      setPan(x: number, y: number): void {
        patchState(store, { panX: x, panY: y });
      },

      resetView(): void {
        patchState(store, { zoom: 1, panX: 0, panY: 0 });
      },

      // Grid
      toggleSnapToGrid(): void {
        patchState(store, { snapToGrid: !store.snapToGrid() });
      },

      toggleGrid(): void {
        patchState(store, { showGrid: !store.showGrid() });
      },

      setGridSize(size: number): void {
        patchState(store, { gridSize: size });
      },

      // Tools
      setActiveTool(tool: EditorTool): void {
        patchState(store, { activeTool: tool, activeCatalogItem: null });
      },

      setActiveCatalogItem(item: CatalogItem | null): void {
        patchState(store, {
          activeCatalogItem: item,
          activeTool: item ? "add-panel" : "select",
        });
      },

      panBy(delta: Point): void {
        patchState(store, (state: EditorExtendedState) => ({
          panX: state.panX + delta.x,
          panY: state.panY + delta.y,
        }));
      },

      generateAutoLayout: rxMethod<string | void>(
        pipe(
          switchMap((shapeId) => {
            const allShapes = store.allShapes();
            const slabShape = shapeId
              ? allShapes.find((s) => s.id === shapeId)
              : allShapes.find(
                  (s) => s.type === "polygon" || s.type === "slab",
                );

            if (
              !slabShape ||
              !slabShape.points ||
              slabShape.points.length < 3
            ) {
              messageService.add({
                severity: "warn",
                summary: "Błąd",
                detail: "Narysuj najpierw kształt stropu (wielokąt)",
                life: 3000,
              });
              return [];
            }

            // Bounding Box to calculate area/dims
            const xs = slabShape.points.map((p: Point) => p.x);
            const ys = slabShape.points.map((p: Point) => p.y);
            const width = Math.max(...xs) - Math.min(...xs);
            const height = Math.max(...ys) - Math.min(...ys);

            return formworkApi
              .calculate({
                slabData: {
                  id: "temp_slab",
                  dimensions: {
                    length: width,
                    width: height,
                    thickness: 20,
                    area: (width * height) / 10000, // m2 approx
                  },
                  points: slabShape.points,
                  type: "monolityczny",
                  beams: [],
                  reinforcement: [],
                  axes: { horizontal: [], vertical: [] },
                },
                params: {
                  slabArea: (width * height) / 10000,
                  slabThickness: 20,
                  floorHeight: 300,
                  includeBeams: false,
                },
              })
              .pipe(
                tap(() => patchState(store, setLoading())),
                tap((result) => {
                  const newShapes = extractShapesFromResult(result, false);
                  if (newShapes.length > 0) {
                    const activeTabId = store.activeTabId();
                    const activeLayerId = store.activeLayerId();
                    patchState(store, (state: EditorExtendedState) => ({
                      tabs: state.tabs.map((t) =>
                        t.id === activeTabId
                          ? {
                              ...t,
                              layers: t.layers.map((l) =>
                                l.id === activeLayerId
                                  ? {
                                      ...l,
                                      shapes: [...l.shapes, ...newShapes],
                                    }
                                  : l,
                              ),
                            }
                          : t,
                      ),
                    }));
                  }
                  messageService.add({
                    severity: "success",
                    summary: "Generowanie Zakończone",
                    detail: `Wygenerowano ${newShapes.length} elementów.`,
                    life: 5000,
                  });
                  patchState(store, setLoaded());
                }),
                catchError((err) => {
                  patchState(store, setError(err.message));
                  return [];
                }),
                map(() => {}),
              );
          }),
        ),
      ),

      generateOptimalLayout: rxMethod<string | void>(
        pipe(
          switchMap((shapeId) => {
            const allShapes = store.allShapes();
            const slabShape = shapeId
              ? allShapes.find((s) => s.id === shapeId)
              : allShapes.find(
                  (s) => s.type === "polygon" || s.type === "slab",
                );

            if (
              !slabShape ||
              !slabShape.points ||
              slabShape.points.length < 3
            ) {
              messageService.add({
                severity: "warn",
                summary: "Błąd",
                detail: "Narysuj najpierw kształt stropu (wielokąt)",
                life: 3000,
              });
              return [];
            }

            const xs = slabShape.points.map((p: Point) => p.x);
            const ys = slabShape.points.map((p: Point) => p.y);
            const width = Math.max(...xs) - Math.min(...xs);
            const height = Math.max(...ys) - Math.min(...ys);

            messageService.add({
              severity: "info",
              summary: "Optymalizacja",
              detail: "Generowanie optymalnego szalunku...",
              life: 2000,
            });

            return formworkApi
              .calculate({
                slabData: {
                  id: "temp_slab",
                  dimensions: {
                    length: width,
                    width: height,
                    thickness: 20,
                    area: (width * height) / 10000,
                  },
                  points: slabShape.points,
                  type: "monolityczny",
                  beams: [],
                  reinforcement: [],
                  axes: { horizontal: [], vertical: [] },
                },
                params: {
                  slabArea: (width * height) / 10000,
                  slabThickness: 20,
                  floorHeight: 300,
                  includeBeams: false,
                  optimizeForWarehouse: true,
                },
              })
              .pipe(
                tap(() => patchState(store, setLoading())),
                tap((result) => {
                  const newShapes = extractShapesFromResult(result, true);
                  if (newShapes.length > 0) {
                    const activeTabId = store.activeTabId();
                    const activeLayerId = store.activeLayerId();
                    patchState(store, (state: EditorExtendedState) => ({
                      tabs: state.tabs.map((t) =>
                        t.id === activeTabId
                          ? {
                              ...t,
                              layers: t.layers.map((l) =>
                                l.id === activeLayerId
                                  ? {
                                      ...l,
                                      shapes: [...l.shapes, ...newShapes],
                                    }
                                  : l,
                              ),
                            }
                          : t,
                      ),
                    }));
                  }
                  messageService.add({
                    severity: "success",
                    summary: "Optymalizacja Zakończona",
                    detail: `Wygenerowano ${newShapes.length} elementów. Uwzględniono stany magazynowe.`,
                    life: 5000,
                  });
                  patchState(store, setLoaded());
                }),
                map(() => {}),
                catchError((err: Error) => {
                  patchState(store, setError(err.message));
                  messageService.add({
                    severity: "error",
                    summary: "Błąd",
                    detail: "Nie udało się wygenerować szalunku",
                  });
                  return [];
                }),
              );
          }),
        ),
      ),

      autoTracePdf: rxMethod<void>(
        pipe(
          switchMap(() => {
            // Feature moved to NewProjectDialog for now
            // We can re-enable this later when we have project ID in store
            messageService.add({
              severity: "info",
              summary: "Info",
              detail: "Funkcja przeniesiona do ekranu tworzenia projektu",
              life: 3000,
            });
            return [];
          }),
        ),
      ),

      setActiveLayer(layerId: string): void {
        patchState(store, { activeLayerId: layerId });
      },

      toggleLayerVisibility(layerId: string): void {
        const activeTabId = store.activeTabId();
        if (!activeTabId) return;

        patchState(store, (state: EditorExtendedState) => ({
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

        patchState(store, (state: EditorExtendedState) => ({
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

        patchState(store, (state: EditorExtendedState) => ({
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
        type: EditorLayer["type"] = "user",
      ): string | null {
        const activeTabId = store.activeTabId();
        if (!activeTabId) return null;

        const newLayer = createDefaultLayer(name, type);

        patchState(store, (state: EditorExtendedState) => ({
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
        if (!layer || layer.type === "system") {
          messageService.add({
            severity: "warn",
            summary: "Uwaga",
            detail: "Nie można edytować tej warstwy",
            life: 3000,
          });
          return;
        }

        patchState(store, (state: EditorExtendedState) => ({
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
        if (!layer || layer.type === "system") {
          messageService.add({
            severity: "warn",
            summary: "Uwaga",
            detail: "Nie można usunąć tej warstwy",
            life: 3000,
          });
          return;
        }

        const currentActiveLayerId = store.activeLayerId();

        patchState(store, (state: EditorExtendedState) => {
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
            selectedIds: [],
          };
        });

        messageService.add({
          severity: "success",
          summary: "Sukces",
          detail: `Warstwa "${layer.name}" została usunięta`,
          life: 3000,
        });
      },

      saveSelectionAsLayer(layerName: string): void {
        const activeTabId = store.activeTabId();
        const selectedIds = store.selectedIds();
        if (!activeTabId || selectedIds.length === 0) {
          messageService.add({
            severity: "warn",
            summary: "Uwaga",
            detail: "Zaznacz elementy, które chcesz przenieść do nowej warstwy",
            life: 3000,
          });
          return;
        }

        const newLayer = createDefaultLayer(layerName, "user");

        patchState(store, (state: EditorExtendedState) => ({
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
          selectedIds: [],
        }));

        messageService.add({
          severity: "success",
          summary: "Sukces",
          detail: `Utworzono warstwę "${layerName}" z ${selectedIds.length} elementami`,
          life: 3000,
        });
      },

      moveSelectionToLayer(targetLayerId: string): void {
        const activeTabId = store.activeTabId();
        const selectedIds = store.selectedIds();
        if (!activeTabId || selectedIds.length === 0) {
          messageService.add({
            severity: "warn",
            summary: "Uwaga",
            detail: "Zaznacz elementy, które chcesz przenieść",
            life: 3000,
          });
          return;
        }

        const tab = store.tabs().find((t) => t.id === activeTabId);
        const targetLayer = tab?.layers.find((l) => l.id === targetLayerId);
        if (!targetLayer) return;

        patchState(store, (state: EditorExtendedState) => ({
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
          selectedIds: [],
        }));

        messageService.add({
          severity: "success",
          summary: "Sukces",
          detail: `Przeniesiono ${selectedIds.length} elementów do warstwy "${targetLayer.name}"`,
          life: 3000,
        });
      },

      reorderLayers(layerId: string, newIndex: number): void {
        const activeTabId = store.activeTabId();
        if (!activeTabId) return;

        patchState(store, (state: EditorExtendedState) => ({
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

      snapToGridPoint(point: Point): Point {
        if (!store.snapToGrid()) return point;
        const grid = store.gridSize();
        return {
          x: Math.round(point.x / grid) * grid,
          y: Math.round(point.y / grid) * grid,
        };
      },

      findNearestSnapPoint(point: Point, radius: number): Point | null {
        // Access referenceGeometry from store state (typed as Signal<unknown | null>)
        type StoreWithReferenceGeometry = {
          referenceGeometry: () => unknown | null;
        };
        const geom = (
          store as unknown as StoreWithReferenceGeometry
        ).referenceGeometry() as {
          polygons?: unknown[];
          lines?: Array<{ a: Point; b: Point }>;
        } | null;
        if (!geom) return null;

        // Support both lines (segment A–B)
        const items: unknown[] = Array.isArray(geom.lines)
          ? geom.lines.map((line) => ({ points: [line.a, line.b] }))
          : (geom.polygons ?? []);
        if (items.length === 0) return null;

        let bestPoint: Point | null = null;
        let minDistance = radius;

        for (const poly of items) {
          const points = getPolygonPoints(poly);
          for (const p of points) {
            const dist = Math.sqrt(
              Math.pow(point.x - p.x, 2) + Math.pow(point.y - p.y, 2),
            );
            if (dist < minDistance) {
              minDistance = dist;
              bestPoint = { x: p.x, y: p.y };
            }
          }
        }

        return bestPoint;
      },

      loadFromProject(
        shapes: Shape[],
        backgroundUrl?: string | null,
        referenceGeometry?: unknown | null,
      ): void {
        const finalBgUrl = backgroundUrl
          ? backgroundUrl.startsWith("http")
            ? backgroundUrl
            : `http://localhost:3000${backgroundUrl}`
          : null;

        const defaultTab = createDefaultTab("Strona 1");
        if (shapes.length > 0) {
          const userLayer = defaultTab.layers.find((l) => l.type === "user");
          if (userLayer) {
            userLayer.shapes = shapes;
          }
        }

        patchState(store, {
          tabs: [defaultTab],
          activeTabId: defaultTab.id,
          activeLayerId:
            defaultTab.layers.find((l) => l.type === "user")?.id ??
            defaultTab.layers[0]?.id ??
            null,
          selectedIds: [],
          backgroundUrl: finalBgUrl || null,
          referenceGeometry: referenceGeometry || null,
          projectId: store.projectId() || null,
        });
      },

      setProjectId(id: string): void {
        patchState(store, { projectId: id });
      },

      save: rxMethod<void>(
        pipe(
          switchMap(() => {
            const id = store.projectId();
            if (!id) return [];

            const tabs = store.tabs();
            const editorData: EditorData = { tabs };

            messageService.add({
              severity: "info",
              summary: "Zapisywanie",
              detail: "Trwa zapisywanie projektu...",
              life: 1000,
            });

            return projectsApi.updateEditorData(id, editorData).pipe(
              tap(() => {
                messageService.add({
                  severity: "success",
                  summary: "Sukces",
                  detail: "Projekt został zapisany",
                });
              }),
              catchError(() => {
                messageService.add({
                  severity: "error",
                  summary: "Błąd",
                  detail: "Nie udało się zapisać projektu",
                });
                return [];
              }),
            );
          }),
        ),
      ),

      loadEditorData: rxMethod<string>(
        pipe(
          tap(() => patchState(store, setLoading())),
          switchMap((projectId) =>
            projectsApi.getById(projectId).pipe(
              tap((project) => {
                const hasDxfData = Boolean(project.geoJsonPath);
                const finalBgUrl = hasDxfData
                  ? null
                  : project.svgPath
                    ? project.svgPath.startsWith("http")
                      ? project.svgPath
                      : `http://localhost:3000${project.svgPath}`
                    : null;

                let tabs: EditorTab[] = [];
                let activeTabId: string | null = null;
                let activeLayerId: string | null = null;

                if (project.editorData) {
                  const data = (
                    typeof project.editorData === "string"
                      ? JSON.parse(project.editorData)
                      : project.editorData
                  ) as EditorData;

                  if (data.tabs && data.tabs.length > 0) {
                    tabs = data.tabs.map((tab, index) => {
                      const hasCadLayer = tab.layers.some(
                        (l) => l.type === "cad",
                      );
                      const isFirstTab = index === 0;
                      if (!hasCadLayer && project.geoJsonPath && isFirstTab) {
                        const cadLayer = createDefaultLayer(
                          "Podkład CAD",
                          "cad",
                        );
                        return { ...tab, layers: [cadLayer, ...tab.layers] };
                      }
                      return tab;
                    });
                    const activeTab = tabs.find((t) => t.active) || tabs[0];
                    activeTabId = activeTab?.id || null;
                    activeLayerId =
                      activeTab?.layers?.find((l) => l.type === "user")?.id ||
                      activeTab?.layers?.[0]?.id ||
                      null;
                  }
                }

                if (tabs.length === 0) {
                  const defaultTab = createDefaultTab("Strona 1");
                  tabs = [defaultTab];
                  activeTabId = defaultTab.id;
                  activeLayerId =
                    defaultTab.layers.find((l) => l.type === "user")?.id ??
                    defaultTab.layers[0]?.id ??
                    null;
                }

                patchState(
                  store,
                  {
                    projectId: project.id,
                    backgroundUrl: finalBgUrl,
                    referenceGeometry: project.extractedSlabGeometry || null,
                    geoJsonPath: project.geoJsonPath ?? null,
                    dxfPath: project.dxfPath ?? null,
                    tabs,
                    activeTabId,
                    activeLayerId,
                    selectedIds: [],
                  },
                  setLoaded(),
                );
              }),
              catchError((err: Error) => {
                patchState(store, setError(err.message));
                return [];
              }),
            ),
          ),
        ),
      ),

      reloadEditorData(): void {
        const projectId = store.projectId();
        if (projectId) {
          this.loadEditorData(projectId);
        }
      },

      addTab(name: string): string {
        const newTab = createEmptyTab(name);

        patchState(store, (state: EditorExtendedState) => {
          const newTabs = [...state.tabs, newTab];
          // Browser behavior: switch to new tab
          return {
            tabs: newTabs.map((t) => ({ ...t, active: t.id === newTab.id })),
            activeTabId: newTab.id,
            activeLayerId: newTab.layers[0]?.id ?? null,
            selectedIds: [],
          };
        });

        return newTab.id;
      },

      removeTab(tabId: string): void {
        const tabs = store.tabs();
        if (tabs.length <= 1) {
          messageService.add({
            severity: "warn",
            summary: "Uwaga",
            detail: "Nie można usunąć ostatniej strony",
            life: 3000,
          });
          return;
        }

        const tabIndex = tabs.findIndex((t) => t.id === tabId);
        const isActive = store.activeTabId() === tabId;

        const currentActiveTabId = store.activeTabId();
        const currentActiveLayerId = store.activeLayerId();

        patchState(store, (state: EditorExtendedState) => {
          const newTabs = state.tabs.filter((t) => t.id !== tabId);
          let nextActiveTabId = currentActiveTabId;
          let nextActiveLayerId = currentActiveLayerId;

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
            selectedIds: [],
          };
        });
      },

      renameTab(tabId: string, newName: string): void {
        patchState(store, (state: EditorExtendedState) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, name: newName } : t,
          ),
        }));
      },

      setActiveTab(tabId: string): void {
        const tab = store.tabs().find((t) => t.id === tabId);
        if (!tab) return;

        patchState(store, (state: EditorExtendedState) => ({
          activeTabId: tabId,
          activeLayerId: tab.layers[0]?.id ?? null,
          tabs: state.tabs.map((t) => ({ ...t, active: t.id === tabId })),
          selectedIds: [],
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
        if (layerToMove.type === "cad" && isFirstTab) {
          messageService.add({
            severity: "warn",
            summary: "Nie można przenieść",
            detail:
              "Warstwy CAD nie można przenosić z pierwszej strony (rzut z CAD).",
            life: 4000,
          });
          return;
        }

        patchState(store, (state: EditorExtendedState) => {
          const newTabs = state.tabs.map((t) => {
            if (t.id === activeTabId) {
              const remainingLayers = t.layers.filter((l) => l.id !== layerId);
              return {
                ...t,
                layers:
                  remainingLayers.length > 0
                    ? remainingLayers
                    : [createDefaultLayer("Warstwa 1", "user")],
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

          // If we moved the active layer, reset activeLayerId to the first available layer in the source tab
          let nextActiveLayerId = state.activeLayerId;
          if (state.activeLayerId === layerId) {
            const updatedSourceTab = newTabs.find((t) => t.id === activeTabId);
            nextActiveLayerId = updatedSourceTab?.layers[0]?.id ?? null;
          }

          return {
            tabs: newTabs,
            activeLayerId: nextActiveLayerId,
            selectedIds: [],
          };
        });

        messageService.add({
          severity: "success",
          summary: "Przeniesiono warstwę",
          detail: `Warstwa "${layerToMove.name}" została przeniesiona.`,
          life: 3000,
        });
      },

      moveLayerToNewTab(layerId: string, tabName: string): void {
        const tabs = store.tabs();
        const activeTabId = store.activeTabId();
        if (!activeTabId || !tabName.trim()) return;

        const sourceTab = tabs.find((t) => t.id === activeTabId);
        if (!sourceTab) return;

        const layerToMove = sourceTab.layers.find((l) => l.id === layerId);
        if (!layerToMove) return;

        const isFirstTab = tabs[0]?.id === sourceTab.id;
        if (layerToMove.type === "cad" && isFirstTab) {
          messageService.add({
            severity: "warn",
            summary: "Nie można przenieść",
            detail:
              "Warstwy CAD nie można przenosić z pierwszej strony (rzut z CAD).",
            life: 4000,
          });
          return;
        }

        const newTab = createEmptyTab(tabName.trim());
        newTab.layers = [layerToMove];

        patchState(store, (state: EditorExtendedState) => {
          const newTabs = state.tabs
            .map((t) => {
              if (t.id !== activeTabId) return t;
              const remainingLayers = t.layers.filter((l) => l.id !== layerId);
              return {
                ...t,
                layers:
                  remainingLayers.length > 0
                    ? remainingLayers
                    : [createDefaultLayer("Warstwa 1", "user")],
              };
            })
            .concat({ ...newTab, active: true });

          return {
            tabs: newTabs.map((t) => ({
              ...t,
              active: t.id === newTab.id,
            })),
            activeTabId: newTab.id,
            activeLayerId: layerToMove.id,
            selectedIds: [],
          };
        });

        messageService.add({
          severity: "success",
          summary: "Przeniesiono warstwę",
          detail: `Warstwa "${layerToMove.name}" została przeniesiona do nowej strony.`,
          life: 3000,
        });
      },

      setViewMode(mode: ViewMode): void {
        patchState(store, {
          viewMode: mode,
        });
      },

      exportToNewTab(): void {
        const selectedIds = store.selectedIds();
        if (selectedIds.length === 0) return;

        const selectedShapes = store
          .allShapes()
          .filter((s: Shape) => selectedIds.includes(s.id));

        const exportId = `export_${Date.now()}`;
        sessionStorage.setItem(exportId, JSON.stringify(selectedShapes));

        const url = new URL(window.location.href);
        url.searchParams.set("exportId", exportId);
        window.open(url.toString(), "_blank");
      },

      clearCanvas(): void {
        const activeTabId = store.activeTabId();
        if (!activeTabId) return;

        patchState(store, (state: EditorExtendedState) => ({
          tabs: state.tabs.map((t) =>
            t.id === activeTabId
              ? { ...t, layers: t.layers.map((l) => ({ ...l, shapes: [] })) }
              : t,
          ),
          selectedIds: [],
        }));
      },
    };
  }),
);

/** Extracts shapes from generation result */
function extractShapesFromResult(
  result: FormworkLayout,
  isOptimal: boolean,
): Shape[] {
  const shapes: Shape[] = [];

  if (!result.elements) return shapes;

  for (const el of result.elements) {
    if (
      (el.elementType === "panel" || el.type === "panel") &&
      el.positionX !== undefined
    ) {
      const x = el.positionX * 100;
      const y = (el.positionY ?? 0) * 100;

      // Use type guard to safely access panel-specific properties
      let w = 120;
      let h = 60;
      if (el.details && isPanelDetails(el.details)) {
        w = el.details.length;
        h = el.details.width;
      }

      const properties: ShapeProperties = {
        fill: isOptimal ? "rgba(76, 175, 80, 0.8)" : "rgba(255, 204, 0, 0.8)",
        stroke: "#1b5e20",
        label: el.name,
        width: w,
        length: h,
        isGenerated: true,
      };

      shapes.push({
        id: `gen_${Math.random().toString(36).substr(2, 9)}`,
        type: "panel",
        x: x,
        y: y,
        rotation: el.rotation ?? 0,
        properties,
      });
    }
  }

  return shapes;
}
