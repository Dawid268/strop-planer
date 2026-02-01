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
  setLoading,
  setLoaded,
  setError,
} from "@angular-architects/ngrx-toolkit";
import { computed, inject } from "@angular/core";
import type {
  Shape,
  EditorTool,
  Point,
  CatalogItem,
  ViewMode,
} from "../models/editor.models";
import { FormworkApiService } from "../../projects/services/formwork-api.service";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { pipe } from "rxjs";
import { tap, switchMap, map, catchError } from "rxjs/operators";
import { MessageService } from "primeng/api";
import { ProjectsService } from "../../projects/services/projects.service";
import {
  EditorData,
  EditorTab,
  EditorLayer,
} from "../../projects/models/project.model";

function createDefaultLayer(name: string, type: EditorLayer["type"] = "user"): EditorLayer {
  return {
    id: `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name,
    shapes: [],
    isVisible: true,
    isLocked: false,
    opacity: 1,
    type,
    color: generateLayerColor(),
  };
}

function createDefaultTab(name: string): EditorTab {
  return {
    id: `tab-${Date.now()}`,
    name,
    active: true,
    layers: [createDefaultLayer("Warstwa 1", "user")],
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
  referenceGeometry: any | null;
  viewMode: ViewMode;
  projectId: string | null;
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
};

export const EditorStore = signalStore(
  { providedIn: "root" },
  withState(initialState),
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
      return tab.layers.find((l) => l.id === state.activeLayerId()) ?? tab.layers[0] ?? null;
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
    isSlabDefined: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      if (!tab) return false;
      const allShapes = tab.layers.flatMap((l) => l.shapes);
      return allShapes.some((s) => s.type === "polygon" || s.type === "slab");
    }),
    slabShapes: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      if (!tab) return [];
      return tab.layers.flatMap((l) => l.shapes).filter((s) => s.type === "slab");
    }),
    panelShapes: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      if (!tab) return [];
      return tab.layers.flatMap((l) => l.shapes).filter((s) => s.type === "panel");
    }),
  })),

  withMethods((store) => {
    const formworkApi = inject(FormworkApiService);
    const projectsService = inject(ProjectsService);
    const messageService = inject(MessageService);

    return {
      // Shape CRUD
      addShape(shape: Shape) {
        const activeTabId = store.activeTabId();
        if (!activeTabId) return;

        patchState(store, (state: EditorExtendedState) => ({
          tabs: state.tabs.map((t) =>
            t.id === activeTabId
              ? {
                  ...t,
                  layers: t.layers.map((l) =>
                    // Add to active layer or first layer
                    l.id === state.activeLayerId
                      ? { ...l, shapes: [...l.shapes, shape] }
                      : l,
                  ),
                }
              : t,
          ),
        }));
      },

      updateShape(id: string, updates: Partial<Shape>) {
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

      removeShape(id: string) {
        const activeTabId = store.activeTabId();
        if (!activeTabId) return;

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
          selectedIds: state.selectedIds.filter((sid) => sid !== id),
        }));
      },

      removeSelectedShapes() {
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
      select(id: string, addToSelection = false) {
        if (addToSelection) {
          patchState(store, { selectedIds: [...store.selectedIds(), id] });
        } else {
          patchState(store, { selectedIds: [id] });
        }
      },

      selectMultiple(ids: string[]) {
        patchState(store, { selectedIds: ids });
      },

      clearSelection() {
        patchState(store, { selectedIds: [] });
      },

      // Viewport
      setZoom(zoom: number) {
        patchState(store, { zoom: Math.max(0.1, Math.min(5, zoom)) });
      },

      setPan(x: number, y: number) {
        patchState(store, { panX: x, panY: y });
      },

      resetView() {
        patchState(store, { zoom: 1, panX: 0, panY: 0 });
      },

      // Grid
      toggleSnapToGrid() {
        patchState(store, { snapToGrid: !store.snapToGrid() });
      },

      toggleGrid() {
        patchState(store, { showGrid: !store.showGrid() });
      },

      setGridSize(size: number) {
        patchState(store, { gridSize: size });
      },

      // Tools
      setActiveTool(tool: EditorTool) {
        patchState(store, { activeTool: tool, activeCatalogItem: null });
      },

      setActiveCatalogItem(item: CatalogItem | null) {
        patchState(store, {
          activeCatalogItem: item,
          activeTool: item ? "add-panel" : "select",
        });
      },

      panBy(delta: Point) {
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
              : allShapes.find((s) => s.type === "polygon" || s.type === "slab");

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
                  processGenerationResult(result, store, messageService);
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
              : allShapes.find((s) => s.type === "polygon" || s.type === "slab");

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
                  processGenerationResult(result, store, messageService, true);
                  patchState(store, setLoaded());
                }),
                map(() => {}), // Return type needs to be void for rxMethod
                catchError((err) => {
                  console.error("Optimization failed", err);
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

      setActiveLayer(layerId: string) {
        patchState(store, { activeLayerId: layerId });
      },

      toggleLayerVisibility(layerId: string) {
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

      toggleLayerLock(layerId: string) {
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

      setLayerOpacity(layerId: string, opacity: number) {
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

      createLayerInActiveTab(name: string, type: EditorLayer["type"] = "user"): string | null {
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

      renameLayer(layerId: string, newName: string) {
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

      deleteLayer(layerId: string) {
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

        patchState(store, (state: EditorExtendedState) => {
          const updatedTabs = state.tabs.map((t) =>
            t.id === activeTabId
              ? { ...t, layers: t.layers.filter((l) => l.id !== layerId) }
              : t,
          );
          const remainingLayers = updatedTabs.find((t) => t.id === activeTabId)?.layers ?? [];

          return {
            tabs: updatedTabs,
            activeLayerId:
              state.activeLayerId === layerId
                ? remainingLayers[0]?.id ?? null
                : state.activeLayerId,
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

      saveSelectionAsLayer(layerName: string) {
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

      moveSelectionToLayer(targetLayerId: string) {
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

      reorderLayers(layerId: string, newIndex: number) {
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
        // Safe access to the signal
        const referenceGeometry = (store as any).referenceGeometry;
        if (!referenceGeometry) return null;

        const geom = referenceGeometry();
        if (!geom || !geom.polygons) return null;

        let bestPoint: Point | null = null;
        let minDistance = radius;

        // Linear scan of all points in all polygons
        // We have ~30k points, which is fine for a single mouse move event
        for (const poly of geom.polygons) {
          for (const p of poly) {
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
        referenceGeometry?: any | null,
      ) {
        console.log("DEBUG: EditorStore.loadFromProject called with:", {
          shapesCount: shapes.length,
          backgroundUrl,
          hasRef: !!referenceGeometry,
        });

        const finalBgUrl = backgroundUrl
          ? backgroundUrl.startsWith("http")
            ? backgroundUrl
            : `http://localhost:3000${backgroundUrl}`
          : null;

        const defaultTab = createDefaultTab("Strona 1");
        if (shapes.length > 0) {
          defaultTab.layers[0].shapes = shapes;
        }

        patchState(store, {
          tabs: [defaultTab],
          activeTabId: defaultTab.id,
          activeLayerId: defaultTab.layers[0]?.id ?? null,
          selectedIds: [],
          backgroundUrl: finalBgUrl || null,
          referenceGeometry: referenceGeometry || null,
          projectId: store.projectId() || null,
        });
      },

      setProjectId(id: string) {
        patchState(store, { projectId: id });
      },

      save: rxMethod<void>(
        pipe(
          switchMap(() => {
            const id = store.projectId();
            if (!id) return [];

            const editorData: EditorData = {
              tabs: store.tabs(),
            };

            messageService.add({
              severity: "info",
              summary: "Zapisywanie",
              detail: "Trwa zapisywanie projektu...",
              life: 1000,
            });

            return projectsService.updateEditorData(id, editorData).pipe(
              tap(() => {
                messageService.add({
                  severity: "success",
                  summary: "Sukces",
                  detail: "Projekt został zapisany",
                });
              }),
              catchError((err) => {
                console.error("Save failed", err);
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
          switchMap((projectId) => {
            console.log("DEBUG: Initializing editor for project:", projectId);
            return projectsService.getById(projectId).pipe(
              tap((project) => {
                console.log("DEBUG: Project data loaded:", {
                  id: project.id,
                  hasEditorData: !!project.editorData,
                  editorDataTabs: (project.editorData as EditorData)?.tabs?.length,
                  svgPath: project.svgPath,
                });

                const finalBgUrl = project.svgPath
                  ? project.svgPath.startsWith("http")
                    ? project.svgPath
                    : `http://localhost:3000${project.svgPath}`
                  : null;

                let tabs: EditorTab[] = [];
                let activeTabId: string | null = null;
                let activeLayerId: string | null = null;

                if (project.editorData) {
                  const data = project.editorData as EditorData;
                  if (data.tabs && data.tabs.length > 0) {
                    tabs = data.tabs;
                    const activeTab = data.tabs.find((t) => t.active) || data.tabs[0];
                    activeTabId = activeTab?.id || null;
                    activeLayerId = activeTab?.layers?.[0]?.id || null;
                  }
                }

                if (tabs.length === 0) {
                  const defaultTab = createDefaultTab("Strona 1");
                  tabs = [defaultTab];
                  activeTabId = defaultTab.id;
                  activeLayerId = defaultTab.layers[0]?.id ?? null;
                }

                console.log("DEBUG: Setting editor state:", {
                  tabsCount: tabs.length,
                  activeTabId,
                  activeLayerId,
                  firstTabLayers: tabs[0]?.layers?.length,
                  firstLayerShapes: tabs[0]?.layers?.[0]?.shapes?.length,
                });

                patchState(
                  store,
                  {
                    projectId: project.id,
                    backgroundUrl: finalBgUrl,
                    referenceGeometry: project.extractedSlabGeometry || null,
                    tabs,
                    activeTabId,
                    activeLayerId,
                    selectedIds: [],
                  },
                  setLoaded(),
                );
              }),
              catchError((err) => {
                console.error("Failed to load editor data", err);
                patchState(store, setError(err.message));
                return [];
              }),
            );
          }),
        ),
      ),

      reloadEditorData() {
        const projectId = store.projectId();
        if (projectId) {
          this.loadEditorData(projectId);
        }
      },

      addTab(name: string): string {
        const newTab = createDefaultTab(name);
        newTab.active = false;

        patchState(store, (state: EditorExtendedState) => ({
          tabs: [...state.tabs, newTab],
        }));

        return newTab.id;
      },

      removeTab(tabId: string) {
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

        patchState(store, (state: EditorExtendedState) => {
          const newTabs = state.tabs.filter((t) => t.id !== tabId);
          let newActiveTabId = state.activeTabId;
          let newActiveLayerId = state.activeLayerId;

          if (isActive && newTabs.length > 0) {
            const newActiveTab = newTabs[Math.min(tabIndex, newTabs.length - 1)];
            newActiveTabId = newActiveTab.id;
            newActiveLayerId = newActiveTab.layers[0]?.id ?? null;
            newTabs.forEach((t) => (t.active = t.id === newActiveTabId));
          }

          return {
            tabs: newTabs,
            activeTabId: newActiveTabId,
            activeLayerId: newActiveLayerId,
            selectedIds: [],
          };
        });
      },

      renameTab(tabId: string, newName: string) {
        patchState(store, (state: EditorExtendedState) => ({
          tabs: state.tabs.map((t) =>
            t.id === tabId ? { ...t, name: newName } : t,
          ),
        }));
      },

      setActiveTab(tabId: string) {
        const tab = store.tabs().find((t) => t.id === tabId);
        if (!tab) return;

        patchState(store, (state: EditorExtendedState) => ({
          activeTabId: tabId,
          activeLayerId: tab.layers[0]?.id ?? null,
          tabs: state.tabs.map((t) => ({ ...t, active: t.id === tabId })),
          selectedIds: [],
        }));
      },

      setViewMode(mode: ViewMode) {
        patchState(store, {
          viewMode: mode,
        });
      },

      exportToNewTab() {
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

      clearCanvas() {
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

function processGenerationResult(
  result: any,
  store: any,
  messageService: MessageService,
  isOptimal = false,
) {
  const newShapes: Shape[] = [];

  if (result.elements) {
    result.elements.forEach((el: any) => {
      if (
        (el.elementType === "panel" || el.type === "panel") &&
        el.positionX !== undefined
      ) {
        const x = el.positionX * 100;
        const y = el.positionY * 100;
        const w = el.details?.length || 120;
        const h = el.details?.width || 60;

        newShapes.push({
          id: `gen_${Math.random().toString(36).substr(2, 9)}`,
          type: "panel",
          x: x,
          y: y,
          rotation: el.rotation || 0,
          properties: {
            fill: isOptimal
              ? "rgba(76, 175, 80, 0.8)"
              : "rgba(255, 204, 0, 0.8)",
            stroke: "#1b5e20",
            label: el.name,
            width: w,
            length: h,
            isGenerated: true,
          } as any,
        } as Shape);
      }
    });

    if (newShapes.length > 0) {
      const activeTabId = store.activeTabId();
      const activeLayerId = store.activeLayerId();

      patchState(store, (state: EditorExtendedState) => ({
        tabs: state.tabs.map((t) => {
          if (t.id !== activeTabId) return t;
          return {
            ...t,
            layers: t.layers.map((l) => {
              if (l.id !== activeLayerId) return l;
              return { ...l, shapes: [...l.shapes, ...newShapes] };
            }),
          };
        }),
      }));
    }

    messageService.add({
      severity: "success",
      summary: isOptimal
        ? "Optymalizacja Zakończona"
        : "Generowanie Zakończone",
      detail: `Wygenerowano ${newShapes.length} elementów. ${
        isOptimal ? "Uwzględniono stany magazynowe." : ""
      }`,
      life: 5000,
    });
  }
}
