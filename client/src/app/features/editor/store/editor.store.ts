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
  EditorState,
  Shape,
  LayerState,
  LayerType,
  EditorTool,
  Point,
  CatalogItem,
  ToolType,
  ViewMode,
} from "../models/editor.models";
import { FormworkApiService } from "../../projects/services/formwork-api.service";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { pipe } from "rxjs";
import { tap, switchMap, map, catchError } from "rxjs/operators";
import { MessageService } from "primeng/api";
import { Project } from "../../projects/models/project.model";
import { ProjectsService } from "../../projects/services/projects.service";

const initialLayers: LayerState[] = [
  {
    id: "slab",
    name: "Płyta stropowa",
    category: "system",
    visible: true,
    locked: false,
    opacity: 1,
    isEditable: false,
    isRemovable: false,
    color: "#9e9e9e",
  },
  {
    id: "beams",
    name: "Belki",
    category: "system",
    visible: true,
    locked: false,
    opacity: 1,
    isEditable: false,
    isRemovable: false,
    color: "#ffeb3b",
  },
  {
    id: "formwork",
    name: "Szalunek",
    category: "data",
    visible: true,
    locked: false,
    opacity: 1,
    isEditable: false,
    isRemovable: false,
    color: "#d32f2f",
  },
  {
    id: "annotations",
    name: "Adnotacje",
    category: "system",
    visible: true,
    locked: false,
    opacity: 0.8,
    isEditable: false,
    isRemovable: false,
    color: "#1976d2",
  },
];

const initialState: EditorState = {
  shapes: [],
  layers: initialLayers,
  selectedIds: [],
  zoom: 1,
  panX: 0,
  panY: 0,
  gridSize: 100, // 100mm = 10cm
  snapToGrid: true,
  showGrid: true,
  activeTool: "select",
  activeCatalogItem: null,
  backgroundUrl: null,
  referenceGeometry: null,
  viewMode: "full",
  projectId: null,
  activeLayerId: "slab",
};

export const EditorStore = signalStore(
  { providedIn: "root" },
  withState(initialState),
  withDevtools("editorStore"),
  withCallState(),
  withComputed((state) => ({
    selectedShapes: computed(() =>
      state.shapes().filter((s) => state.selectedIds().includes(s.id)),
    ),
    visibleShapes: computed(() => {
      const layers = state.layers();
      const visibleLayerIds = layers.filter((l) => l.visible).map((l) => l.id);

      return state
        .shapes()
        .filter((s) => s.layer && visibleLayerIds.includes(s.layer))
        .map((s) => {
          const layer = layers.find((l) => l.id === s.layer);
          return {
            ...s,
            opacity: layer?.opacity ?? 1,
            zIndex: layers.findIndex((l) => l.id === s.layer),
          };
        })
        .sort((a, b) => a.zIndex - b.zIndex);
    }),
    isSlabDefined: computed(() =>
      state.shapes().some((s) => s.type === "polygon" || s.type === "slab"),
    ),
    slabShapes: computed(() => state.shapes().filter((s) => s.type === "slab")),
    panelShapes: computed(() =>
      state.shapes().filter((s) => s.type === "panel"),
    ),
  })),

  withMethods((store) => {
    const formworkApi = inject(FormworkApiService);
    const projectsService = inject(ProjectsService);
    const messageService = inject(MessageService);

    return {
      // Shape CRUD
      addShape(shape: Shape) {
        patchState(store, { shapes: [...store.shapes(), shape] });
      },

      updateShape(id: string, updates: Partial<Shape>) {
        patchState(store, {
          shapes: store
            .shapes()
            .map((s) => (s.id === id ? ({ ...s, ...updates } as Shape) : s)),
        });
      },

      removeShape(id: string) {
        patchState(store, {
          shapes: store.shapes().filter((s) => s.id !== id),
          selectedIds: store.selectedIds().filter((sid) => sid !== id),
        });
      },

      removeSelectedShapes() {
        const selected = store.selectedIds();
        patchState(store, {
          shapes: store.shapes().filter((s: Shape) => !selected.includes(s.id)),
          selectedIds: [],
        });
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
        patchState(store, (state: EditorState) => ({
          panX: state.panX + delta.x,
          panY: state.panY + delta.y,
        }));
      },

      generateAutoLayout: rxMethod<string | void>(
        pipe(
          switchMap((shapeId) => {
            const state = store.shapes();
            // If shapeId is provided, find that specific shape, otherwise find first polygon/slab
            const slabShape = shapeId
              ? state.find((s) => s.id === shapeId)
              : state.find((s) => s.type === "polygon" || s.type === "slab");

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
            const state = store.shapes();
            const slabShape = shapeId
              ? state.find((s) => s.id === shapeId)
              : state.find((s) => s.type === "polygon" || s.type === "slab");

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

      // Layers
      setActiveLayer(layerId: string) {
        patchState(store, { activeLayerId: layerId });
      },

      toggleLayerVisibility(layerId: string) {
        patchState(store, {
          layers: store
            .layers()
            .map((l: LayerState) =>
              l.id === layerId ? { ...l, visible: !l.visible } : l,
            ),
        });
      },

      toggleLayerLock(layerId: string) {
        patchState(store, {
          layers: store
            .layers()
            .map((l: LayerState) =>
              l.id === layerId ? { ...l, locked: !l.locked } : l,
            ),
        });
      },

      setLayerOpacity(layerId: string, opacity: number) {
        patchState(store, {
          layers: store
            .layers()
            .map((l: LayerState) => (l.id === layerId ? { ...l, opacity } : l)),
        });
      },

      /** Create a new user layer */
      createLayer(name: string, color?: string): string {
        const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newLayer: LayerState = {
          id,
          name,
          category: "user",
          visible: true,
          locked: false,
          opacity: 1,
          isEditable: true,
          isRemovable: true,
          color: color || this.generateLayerColor(),
        };
        patchState(store, {
          layers: [...store.layers(), newLayer],
          activeLayerId: id,
        });
        return id;
      },

      /** Generate a random color for new layers */
      generateLayerColor(): string {
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
      },

      /** Rename a user layer */
      renameLayer(layerId: string, newName: string) {
        const layer = store.layers().find((l) => l.id === layerId);
        if (!layer || !layer.isEditable) {
          messageService.add({
            severity: "warn",
            summary: "Uwaga",
            detail: "Nie można edytować tej warstwy",
            life: 3000,
          });
          return;
        }
        patchState(store, {
          layers: store
            .layers()
            .map((l: LayerState) =>
              l.id === layerId ? { ...l, name: newName } : l,
            ),
        });
      },

      /** Delete a user layer */
      deleteLayer(layerId: string) {
        const layer = store.layers().find((l) => l.id === layerId);
        if (!layer || !layer.isRemovable) {
          messageService.add({
            severity: "warn",
            summary: "Uwaga",
            detail: "Nie można usunąć tej warstwy",
            life: 3000,
          });
          return;
        }
        // Remove all shapes from this layer first
        patchState(store, {
          shapes: store.shapes().filter((s) => s.layer !== layerId),
          layers: store.layers().filter((l) => l.id !== layerId),
          activeLayerId:
            store.activeLayerId() === layerId ? "slab" : store.activeLayerId(),
          selectedIds: store.selectedIds().filter((id) => {
            const shape = store.shapes().find((s) => s.id === id);
            return shape?.layer !== layerId;
          }),
        });
        messageService.add({
          severity: "success",
          summary: "Sukces",
          detail: `Warstwa "${layer.name}" została usunięta`,
          life: 3000,
        });
      },

      /** Create a new layer from current selection */
      saveSelectionAsLayer(layerName: string) {
        const selectedIds = store.selectedIds();
        if (selectedIds.length === 0) {
          messageService.add({
            severity: "warn",
            summary: "Uwaga",
            detail: "Zaznacz elementy, które chcesz przenieść do nowej warstwy",
            life: 3000,
          });
          return;
        }
        // Create new layer
        const layerId = this.createLayer(layerName);
        // Move shapes to new layer
        patchState(store, {
          shapes: store
            .shapes()
            .map((s) =>
              selectedIds.includes(s.id) ? { ...s, layer: layerId } : s,
            ),
        });
        messageService.add({
          severity: "success",
          summary: "Sukces",
          detail: `Utworzono warstwę "${layerName}" z ${selectedIds.length} elementami`,
          life: 3000,
        });
      },

      /** Move current selection to an existing layer */
      moveSelectionToLayer(targetLayerId: string) {
        const selectedIds = store.selectedIds();
        if (selectedIds.length === 0) {
          messageService.add({
            severity: "warn",
            summary: "Uwaga",
            detail: "Zaznacz elementy, które chcesz przenieść",
            life: 3000,
          });
          return;
        }
        const targetLayer = store.layers().find((l) => l.id === targetLayerId);
        if (!targetLayer) return;

        patchState(store, {
          shapes: store
            .shapes()
            .map((s) =>
              selectedIds.includes(s.id) ? { ...s, layer: targetLayerId } : s,
            ),
        });
        messageService.add({
          severity: "success",
          summary: "Sukces",
          detail: `Przeniesiono ${selectedIds.length} elementów do warstwy "${targetLayer.name}"`,
          life: 3000,
        });
      },

      /** Reorder layers by moving a layer to a new index */
      reorderLayers(layerId: string, newIndex: number) {
        const layers = [...store.layers()];
        const currentIndex = layers.findIndex((l) => l.id === layerId);
        if (currentIndex === -1 || newIndex < 0 || newIndex >= layers.length)
          return;

        const [removed] = layers.splice(currentIndex, 1);
        layers.splice(newIndex, 0, removed);
        patchState(store, { layers });
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

      // Import project data
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

        // If project has svgPath, prefer it over generic PDF background
        const finalBgUrl = backgroundUrl
          ? backgroundUrl.startsWith("http")
            ? backgroundUrl
            : `http://localhost:3000${backgroundUrl}`
          : null;

        patchState(store, {
          shapes,
          selectedIds: [],
          backgroundUrl: finalBgUrl || null,
          referenceGeometry: referenceGeometry || null,
          projectId: store.projectId() || null, // Keep existing if not provided
        });
      },

      setProjectId(id: string) {
        patchState(store, { projectId: id });
      },

      save: rxMethod<void>(
        pipe(
          switchMap(() => {
            const id = store.projectId();
            if (!id) {
              messageService.add({
                severity: "error",
                summary: "Błąd",
                detail: "Brak ID projektu - nie można zapisać",
              });
              return [];
            }

            const shapes = store.shapes();
            const slabShapes = store.slabShapes();

            // Prepare results
            const optimizationResult = JSON.stringify({ shapes });
            const extractedSlabGeometry =
              slabShapes.length > 0
                ? JSON.stringify({
                    polygons: slabShapes.map((s: Shape) => s.points),
                  })
                : undefined;

            messageService.add({
              severity: "info",
              summary: "Zapisywanie",
              detail: "Trwa zapisywanie projektu...",
              life: 1000,
            });

            return projectsService
              .update(id, {
                optimizationResult,
                extractedSlabGeometry,
              })
              .pipe(
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

      setViewMode(mode: ViewMode) {
        patchState(store, {
          viewMode: mode,
        });
      },

      exportToNewTab() {
        const selectedIds = store.selectedIds();
        if (selectedIds.length === 0) return;

        const selectedShapes = store
          .shapes()
          .filter((s: Shape) => selectedIds.includes(s.id));

        // Store selected shapes in session storage to pass to new tab
        const exportId = `export_${Date.now()}`;
        sessionStorage.setItem(exportId, JSON.stringify(selectedShapes));

        // Open new tab with same URL but adding exportId param
        const url = new URL(window.location.href);
        url.searchParams.set("exportId", exportId);
        window.open(url.toString(), "_blank");
      },

      // Clear all
      clearCanvas() {
        patchState(store, { shapes: [], selectedIds: [] });
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
        // Position X/Y from backend are in meters, convert to cm (1 unit = 1 px/cm)
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
          layer: "formwork",
        } as Shape);
      }
    });

    // Update shapes in store
    patchState(store, (s: EditorState) => ({
      shapes: [...s.shapes, ...newShapes],
    }));

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
