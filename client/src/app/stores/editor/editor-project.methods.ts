/**
 * Editor Store - Project loading & saving methods
 * Load editor data from API, save back, manage project context.
 */
import { patchState } from '@ngrx/signals';
import {
  setLoading,
  setLoaded,
  setError,
} from '@angular-architects/ngrx-toolkit';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe } from 'rxjs';
import { switchMap, tap, catchError } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { ProjectsApiService } from '@api/projects-api.service';
import type { Shape, ViewMode, Point, EditorTool, CatalogItem } from '@models/editor.models';
import type { EditorData, EditorTab } from '@models/project.model';
import type { EditorExtendedState, EditorStoreRef } from './editor.state';
import { createDefaultTab, createDefaultLayer } from './editor.helpers';
import { getPolygonPoints } from '@utils/canvas.utils';

// ============================================================================
// Constants
// ============================================================================

const API_BASE_URL = 'http://localhost:3000';

function resolveUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
}

// ============================================================================
// Public API
// ============================================================================

export function createProjectMethods(
  store: EditorStoreRef,
  projectsApi: ProjectsApiService,
  messageService: MessageService,
) {
  // Methods object — allows internal cross-references (e.g. reloadEditorData → loadEditorData)
  const methods = {
    /** Set project ID in store */
    setProjectId(id: string): void {
      patchState(store, { projectId: id });
    },

    /** Load shapes from a project (e.g. from exported data) */
    loadFromProject(
      shapes: Shape[],
      backgroundUrl?: string | null,
      referenceGeometry?: unknown | null,
    ): void {
      const defaultTab = createDefaultTab('Strona 1');
      if (shapes.length > 0) {
        const userLayer = defaultTab.layers.find((l) => l.type === 'user');
        if (userLayer) {
          userLayer.shapes = shapes;
        }
      }

      patchState(store, {
        tabs: [defaultTab],
        activeTabId: defaultTab.id,
        activeLayerId:
          defaultTab.layers.find((l) => l.type === 'user')?.id ??
          defaultTab.layers[0]?.id ??
          null,
        selectedIds: [],
        backgroundUrl: resolveUrl(backgroundUrl) || null,
        referenceGeometry: referenceGeometry || null,
        projectId: store.projectId() || null,
      });
    },

    /** Load editor data from server (full project fetch) */
    loadEditorData: rxMethod<string>(
      pipe(
        tap(() => patchState(store, setLoading())),
        switchMap((projectId) =>
          projectsApi.getById(projectId).pipe(
            tap((project) => {
              const hasDxfData = Boolean(project.geoJsonPath);
              const finalBgUrl = hasDxfData
                ? null
                : resolveUrl(project.svgPath);

              let tabs: EditorTab[] = [];
              let activeTabId: string | null = null;
              let activeLayerId: string | null = null;

              if (project.editorData) {
                try {
                  const data = (
                    typeof project.editorData === 'string'
                      ? JSON.parse(project.editorData)
                      : project.editorData
                  ) as EditorData;

                  if (data.tabs && data.tabs.length > 0) {
                    tabs = data.tabs.map((tab, index) => {
                      const hasCadLayer = tab.layers.some(
                        (l) => l.type === 'cad',
                      );
                      if (
                        !hasCadLayer &&
                        project.geoJsonPath &&
                        index === 0
                      ) {
                        const cadLayer = createDefaultLayer(
                          'Podkład CAD',
                          'cad',
                        );
                        return {
                          ...tab,
                          layers: [cadLayer, ...tab.layers],
                        };
                      }
                      return tab;
                    });

                    const activeTab =
                      tabs.find((t) => t.active) || tabs[0];
                    activeTabId = activeTab?.id || null;
                    activeLayerId =
                      activeTab?.layers?.find((l) => l.type === 'user')
                        ?.id ||
                      activeTab?.layers?.[0]?.id ||
                      null;
                  }
                } catch {
                  // Invalid editor data JSON — fall through to default tab
                }
              }

              if (tabs.length === 0) {
                const defaultTab = createDefaultTab('Strona 1');
                tabs = [defaultTab];
                activeTabId = defaultTab.id;
                activeLayerId =
                  defaultTab.layers.find((l) => l.type === 'user')?.id ??
                  defaultTab.layers[0]?.id ??
                  null;
              }

              patchState(
                store,
                {
                  projectId: project.id,
                  backgroundUrl: finalBgUrl,
                  referenceGeometry:
                    project.extractedSlabGeometry || null,
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

    /** Reload editor data for the current project */
    reloadEditorData(): void {
      const projectId = store.projectId();
      if (projectId) {
        methods.loadEditorData(projectId);
      }
    },

    /** Save current editor state to server */
    save: rxMethod<void>(
      pipe(
        switchMap(() => {
          const id = store.projectId();
          if (!id) return [];

          const tabs = store.tabs();
          const editorData: EditorData = { tabs };

          messageService.add({
            severity: 'info',
            summary: 'Zapisywanie',
            detail: 'Trwa zapisywanie projektu...',
            life: 1000,
          });

          return projectsApi.updateEditorData(id, editorData).pipe(
            tap(() => {
              messageService.add({
                severity: 'success',
                summary: 'Sukces',
                detail: 'Projekt został zapisany',
              });
            }),
            catchError(() => {
              messageService.add({
                severity: 'error',
                summary: 'Błąd',
                detail: 'Nie udało się zapisać projektu',
              });
              return [];
            }),
          );
        }),
      ),
    ),

    // ========================================================================
    // Viewport & Grid (simple, kept here for convenience)
    // ========================================================================

    setZoom(zoom: number): void {
      patchState(store, { zoom: Math.max(0.1, Math.min(5, zoom)) });
    },

    setPan(x: number, y: number): void {
      patchState(store, { panX: x, panY: y });
    },

    resetView(): void {
      patchState(store, { zoom: 1, panX: 0, panY: 0 });
    },

    panBy(delta: Point): void {
      patchState(store, (state: EditorExtendedState) => ({
        panX: state.panX + delta.x,
        panY: state.panY + delta.y,
      }));
    },

    toggleSnapToGrid(): void {
      patchState(store, { snapToGrid: !store.snapToGrid() });
    },

    toggleGrid(): void {
      patchState(store, { showGrid: !store.showGrid() });
    },

    setGridSize(size: number): void {
      patchState(store, { gridSize: Math.max(1, size) });
    },

    setViewMode(mode: ViewMode): void {
      patchState(store, { viewMode: mode });
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
      const geom = store.referenceGeometry() as {
        polygons?: unknown[];
        lines?: Array<{ a: Point; b: Point }>;
      } | null;
      if (!geom) return null;

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

    // ========================================================================
    // Selection & Tools (simple, kept here for convenience)
    // ========================================================================

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

    setActiveTool(tool: EditorTool): void {
      patchState(store, { activeTool: tool, activeCatalogItem: null });
    },

    setActiveCatalogItem(item: CatalogItem | null): void {
      patchState(store, {
        activeCatalogItem: item,
        activeTool: item ? 'add-panel' : 'select',
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
      url.searchParams.set('exportId', exportId);
      window.open(url.toString(), '_blank');
    },

    clearCanvas(): void {
      const activeTabId = store.activeTabId();
      if (!activeTabId) return;

      patchState(store, (state: EditorExtendedState) => ({
        tabs: state.tabs.map((t) =>
          t.id === activeTabId
            ? {
                ...t,
                layers: t.layers.map((l) => ({ ...l, shapes: [] })),
              }
            : t,
        ),
        selectedIds: [],
      }));
    },
  };

  return methods;
}
