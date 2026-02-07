import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import {
  withDevtools,
  withCallState,
  withStorageSync,
  setLoading,
  setLoaded,
  setError,
} from '@angular-architects/ngrx-toolkit';

import { FloorPlanApiService } from '@api/floor-plan-api.service';
import type { FloorPlanState, SelectedEntity } from '@models/floor-plan.model';

const initialState: FloorPlanState = {
  document: null,
  visibleLayers: new Set<string>(),
  selectedEntity: null,
  showGrid: true,
  isSelectionMode: false,
};

export const FloorPlanStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withStorageSync({
    key: 'floorPlanState',
    select: (state: FloorPlanState) => ({
      showGrid: state.showGrid,
      isSelectionMode: state.isSelectionMode,
    }),
  }),
  withDevtools('floorPlanStore'),
  withCallState(),
  withComputed((store) => ({
    layers: computed(() => store.document()?.data.layers ?? []),
    entityCount: computed(() => store.document()?.data.entities.length ?? 0),
    documentId: computed(() => store.document()?.documentId ?? null),
    bounds: computed(() => store.document()?.data.bounds ?? null),
    hasDocument: computed(() => store.document() !== null),
  })),
  withMethods((store, api = inject(FloorPlanApiService)) => ({
    /**
     * Upload floor plan file with progress tracking
     */
    uploadFile: rxMethod<File>(
      pipe(
        tap(() => patchState(store, setLoading())),
        switchMap((file) =>
          api.upload(file).pipe(
            tapResponse({
              next: (result) => {
                if (result.type === 'complete' && result.data) {
                  const layers = new Set(result.data.data.layers);
                  patchState(
                    store,
                    {
                      document: result.data,
                      visibleLayers: layers,
                      selectedEntity: null,
                    },
                    setLoaded(),
                  );
                }
              },
              error: (error: Error) => {
                patchState(
                  store,
                  setError(error.message || 'Błąd przetwarzania pliku'),
                );
              },
            }),
          ),
        ),
      ),
    ),

    /**
     * Load document by ID
     */
    loadDocument: rxMethod<string>(
      pipe(
        tap(() => patchState(store, setLoading())),
        switchMap((documentId) =>
          api.getById(documentId).pipe(
            tapResponse({
              next: (data) => {
                const layers = new Set(data.layers);
                patchState(
                  store,
                  {
                    document: { documentId, data },
                    visibleLayers: layers,
                    selectedEntity: null,
                  },
                  setLoaded(),
                );
              },
              error: (error: Error) => {
                patchState(
                  store,
                  setError(error.message || 'Błąd ładowania dokumentu'),
                );
              },
            }),
          ),
        ),
      ),
    ),

    /**
     * Toggle layer visibility
     */
    toggleLayer: (layer: string): void => {
      const visible = new Set(store.visibleLayers());
      if (visible.has(layer)) {
        visible.delete(layer);
      } else {
        visible.add(layer);
      }
      patchState(store, { visibleLayers: visible });
    },

    /**
     * Check if layer is visible
     */
    isLayerVisible: (layer: string): boolean => {
      return store.visibleLayers().has(layer);
    },

    /**
     * Set selected entity
     */
    setSelectedEntity: (entity: SelectedEntity | null): void => {
      patchState(store, { selectedEntity: entity });
    },

    /**
     * Toggle selection mode
     */
    toggleSelectionMode: (): void => {
      patchState(store, { isSelectionMode: !store.isSelectionMode() });
    },

    /**
     * Toggle grid visibility
     */
    toggleGrid: (): void => {
      patchState(store, { showGrid: !store.showGrid() });
    },

    /**
     * Clear current document
     */
    clearDocument: (): void => {
      patchState(store, {
        document: null,
        visibleLayers: new Set<string>(),
        selectedEntity: null,
      });
    },

    /**
     * Clear error state
     */
    clearError: (): void => {
      patchState(store, setLoaded());
    },
  })),
);
