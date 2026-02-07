/**
 * Editor Store - Formwork generation methods
 * Auto-layout and optimal layout generation via FormworkApiService.
 */
import { patchState } from '@ngrx/signals';
import { setLoading, setLoaded, setError } from '@angular-architects/ngrx-toolkit';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe } from 'rxjs';
import { switchMap, tap, map, catchError } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { FormworkApiService } from '@api/formwork-api.service';
import type {
  Shape,
  ShapeProperties,
  Point,
} from '@models/editor.models';
import type { FormworkLayout } from '@models/formwork.models';
import { isPanelDetails } from '@models/formwork.models';
import type { EditorExtendedState, EditorStoreRef } from './editor.state';


// ============================================================================
// Result Extraction
// ============================================================================

function extractShapesFromResult(
  result: FormworkLayout,
  isOptimal: boolean,
): Shape[] {
  const shapes: Shape[] = [];
  if (!result.elements) return shapes;

  for (const el of result.elements) {
    if (
      (el.elementType === 'panel' || el.type === 'panel') &&
      el.positionX !== undefined
    ) {
      let w = 120;
      let h = 60;
      if (el.details && isPanelDetails(el.details)) {
        w = el.details.length;
        h = el.details.width;
      }

      const properties: ShapeProperties = {
        fill: isOptimal
          ? 'rgba(76, 175, 80, 0.8)'
          : 'rgba(255, 204, 0, 0.8)',
        stroke: '#1b5e20',
        label: el.name,
        width: w,
        length: h,
        isGenerated: true,
      };

      shapes.push({
        id: `gen_${Math.random().toString(36).substr(2, 9)}`,
        type: 'panel',
        x: el.positionX * 100,
        y: (el.positionY ?? 0) * 100,
        rotation: el.rotation ?? 0,
        properties,
      });
    }
  }
  return shapes;
}

// ============================================================================
// Shared: build slab request DTO from a polygon/slab shape
// ============================================================================

function buildSlabRequest(slabShape: Shape) {
  const xs = slabShape.points!.map((p: Point) => p.x);
  const ys = slabShape.points!.map((p: Point) => p.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);

  return {
    slabData: {
      id: 'temp_slab',
      dimensions: {
        length: width,
        width: height,
        thickness: 20,
        area: (width * height) / 10000,
      },
      points: slabShape.points!,
      type: 'monolityczny' as const,
      beams: [],
      reinforcement: [],
      axes: { horizontal: [], vertical: [] },
    },
    width,
    height,
  };
}

// ============================================================================
// Public API
// ============================================================================

export function createFormworkMethods(
  store: EditorStoreRef,
  formworkApi: FormworkApiService,
  messageService: MessageService,
) {
  /** Find the target slab shape from store */
  function findSlabShape(shapeId?: string | void): Shape | null {
    const allShapes = store.allShapes();
    const shape = shapeId
      ? allShapes.find((s) => s.id === shapeId)
      : allShapes.find(
          (s) => s.type === 'polygon' || s.type === 'slab',
        );

    if (!shape || !shape.points || shape.points.length < 3) {
      messageService.add({
        severity: 'warn',
        summary: 'Błąd',
        detail: 'Narysuj najpierw kształt stropu (wielokąt)',
        life: 3000,
      });
      return null;
    }
    return shape;
  }

  /** Patch generated shapes into the active tab/layer */
  function addGeneratedShapes(newShapes: Shape[]): void {
    if (newShapes.length === 0) return;
    const activeTabId = store.activeTabId();
    const activeLayerId = store.activeLayerId();

    patchState(store, (state: EditorExtendedState) => ({
      tabs: state.tabs.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              layers: t.layers.map((l) =>
                l.id === activeLayerId
                  ? { ...l, shapes: [...l.shapes, ...newShapes] }
                  : l,
              ),
            }
          : t,
      ),
    }));
  }

  return {
    /** Generate standard formwork layout */
    generateAutoLayout: rxMethod<string | void>(
      pipe(
        switchMap((shapeId) => {
          const slabShape = findSlabShape(shapeId);
          if (!slabShape) return [];

          const { slabData, width, height } = buildSlabRequest(slabShape);
          return formworkApi
            .calculate({
              slabData,
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
                addGeneratedShapes(newShapes);
                messageService.add({
                  severity: 'success',
                  summary: 'Generowanie Zakończone',
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

    /** Generate optimal formwork layout (warehouse-aware) */
    generateOptimalLayout: rxMethod<string | void>(
      pipe(
        switchMap((shapeId) => {
          const slabShape = findSlabShape(shapeId);
          if (!slabShape) return [];

          messageService.add({
            severity: 'info',
            summary: 'Optymalizacja',
            detail: 'Generowanie optymalnego szalunku...',
            life: 2000,
          });

          const { slabData, width, height } = buildSlabRequest(slabShape);
          return formworkApi
            .calculate({
              slabData,
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
                addGeneratedShapes(newShapes);
                messageService.add({
                  severity: 'success',
                  summary: 'Optymalizacja Zakończona',
                  detail: `Wygenerowano ${newShapes.length} elementów. Uwzględniono stany magazynowe.`,
                  life: 5000,
                });
                patchState(store, setLoaded());
              }),
              map(() => {}),
              catchError((err: Error) => {
                patchState(store, setError(err.message));
                messageService.add({
                  severity: 'error',
                  summary: 'Błąd',
                  detail: 'Nie udało się wygenerować szalunku',
                });
                return [];
              }),
            );
        }),
      ),
    ),

    /** Auto-trace PDF (currently redirects to project creation) */
    autoTracePdf: rxMethod<void>(
      pipe(
        switchMap(() => {
          messageService.add({
            severity: 'info',
            summary: 'Info',
            detail: 'Funkcja przeniesiona do ekranu tworzenia projektu',
            life: 3000,
          });
          return [];
        }),
      ),
    ),
  };
}
