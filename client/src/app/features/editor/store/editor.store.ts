import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from "@ngrx/signals";
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
} from "../models/editor.models";
import { FormworkApiService } from "../../projects/services/formwork-api.service";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { pipe } from "rxjs";
import { tap, switchMap, map, catchError } from "rxjs/operators";
import { MessageService } from "primeng/api";
import { Project } from "../../projects/models/project.model";
import { ProjectsService } from "../../projects/services/projects.service";

const initialLayers: LayerState[] = [
  { name: "slab", visible: true, locked: false, opacity: 1 },
  { name: "beams", visible: true, locked: false, opacity: 1 },
  { name: "formwork", visible: true, locked: false, opacity: 1 },
  { name: "annotations", visible: true, locked: false, opacity: 0.8 },
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
};

export const EditorStore = signalStore(
  withState(initialState),

  withComputed((state) => ({
    selectedShapes: computed(() =>
      state.shapes().filter((s) => state.selectedIds().includes(s.id)),
    ),
    visibleShapes: computed(() => {
      const visibleLayers = state
        .layers()
        .filter((l) => l.visible)
        .map((l) => l.name);
      return state
        .shapes()
        .filter((s) => s.layer && visibleLayers.includes(s.layer));
    }),
    slabShapes: computed(() => state.shapes().filter((s) => s.type === "slab")),
    panelShapes: computed(() =>
      state.shapes().filter((s) => s.type === "panel"),
    ),
  })),

  withMethods((store) => {
    const formworkApi = inject(FormworkApiService);
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
          shapes: store.shapes().filter((s) => !selected.includes(s.id)),
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
        patchState(store, (state) => ({
          panX: state.panX + delta.x,
          panY: state.panY + delta.y,
        }));
      },

      generateAutoLayout: rxMethod<void>(
        pipe(
          switchMap(() => {
            const state = store.shapes();
            const slabShape = state.find((s) => s.type === "polygon");

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

            // Convert points relative to canvas? No, assume canvas is 1:1 cm or m?
            // Editor usually works in pixels. We need a scale factor.
            // For MVP, let's assume 1 px = 1 cm.
            // Bounding Box to calculate area/dims
            const xs = slabShape.points.map((p) => p.x);
            const ys = slabShape.points.map((p) => p.y);
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
                tap((result) => {
                  const newShapes: Shape[] = [];
                  // Keep only the slab (polygon) and non-generated shapes?
                  // Or just append panels on top.

                  result.elements.forEach((el: any) => {
                    if (
                      el.elementType === "panel" &&
                      el.positionX !== undefined
                    ) {
                      // Create a rectangle shape for the panel
                      // positionX is in METERS (from backend).
                      // We need to convert back to pixels/cm.
                      // If 1 px = 1 cm, then X * 100.
                      // Also backend positions are likely top-left or center?
                      // My Grid algo used top-left.

                      const x = el.positionX * 100;
                      const y = el.positionY * 100;
                      const w = el.details.length;
                      const h = el.details.width;

                      newShapes.push({
                        id: `gen_${Math.random()}`,
                        type: "rectangle",
                        x: x,
                        y: y,
                        width: w,
                        height: h,
                        properties: {
                          fill: "#ffcc00", // Yellow panels
                          stroke: "#000",
                          opacity: 0.8,
                          label: el.name,
                        },
                      });
                    }
                  });

                  // Remove old generated shapes?
                  // For now just add new ones
                  patchState(store, (s) => ({
                    shapes: [...s.shapes, ...newShapes],
                  }));

                  messageService.add({
                    severity: "success",
                    summary: "Sukces",
                    detail: `Wygenerowano ${newShapes.length} elementów szalunku`,
                    life: 3000,
                  });
                }),
                map(() => {}),
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
      toggleLayerVisibility(layer: LayerType) {
        patchState(store, {
          layers: store
            .layers()
            .map((l) => (l.name === layer ? { ...l, visible: !l.visible } : l)),
        });
      },

      toggleLayerLock(layer: LayerType) {
        patchState(store, {
          layers: store
            .layers()
            .map((l) => (l.name === layer ? { ...l, locked: !l.locked } : l)),
        });
      },

      // Utility: Snap point to grid
      snapToGridPoint(point: Point): Point {
        if (!store.snapToGrid()) return point;
        const grid = store.gridSize();
        return {
          x: Math.round(point.x / grid) * grid,
          y: Math.round(point.y / grid) * grid,
        };
      },

      // Import project data
      loadFromProject(shapes: Shape[], backgroundUrl?: string | null) {
        console.log("DEBUG: EditorStore.loadFromProject called with:", {
          shapesCount: shapes.length,
          backgroundUrl,
        });

        // If project has svgPath, prefer it over generic PDF background
        // Assuming backend serves it at http://localhost:3000 + svgPath
        const finalBgUrl = backgroundUrl
          ? backgroundUrl.startsWith("http")
            ? backgroundUrl
            : `http://localhost:3000${backgroundUrl}`
          : null;

        console.log("DEBUG: EditorStore finalBgUrl computed:", finalBgUrl);

        patchState(store, {
          shapes,
          selectedIds: [],
          backgroundUrl: finalBgUrl || null,
        });
      },

      // Clear all
      clearCanvas() {
        patchState(store, { shapes: [], selectedIds: [] });
      },
    };
  }),
);
