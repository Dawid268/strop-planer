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
  setLoading,
  setLoaded,
  setError,
} from '@angular-architects/ngrx-toolkit';
import { InventoryApiService } from '../services/inventory-api.service';
import type {
  InventoryItem,
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  InventorySummary,
} from '../models/inventory.model';

interface InventoryState {
  items: InventoryItem[];
  summary: InventorySummary | null;
  filters: { type?: string; system?: string; manufacturer?: string };
}

const initialState: InventoryState = {
  items: [],
  summary: null,
  filters: {},
};

export const InventoryStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withDevtools('inventoryStore'),
  withCallState(),
  withComputed((store) => ({
    itemCount: computed(() => store.items().length),
    panels: computed(() => store.items().filter((i) => i.type === 'panel')),
    props: computed(() => store.items().filter((i) => i.type === 'prop')),
    filteredItems: computed(() => {
      const items = store.items();
      const f = store.filters();
      return items.filter((i) => {
        if (f.type && i.type !== f.type) return false;
        if (f.system && i.system !== f.system) return false;
        if (f.manufacturer && i.manufacturer !== f.manufacturer) return false;
        return true;
      });
    }),
  })),
  withMethods((store, api = inject(InventoryApiService)) => ({
    loadItems: rxMethod<{
      type?: string;
      system?: string;
      manufacturer?: string;
    } | void>(
      pipe(
        tap((filters) =>
          patchState(store, { filters: filters || {} }, setLoading()),
        ),
        switchMap((filters) =>
          api.getAll(filters || {}).pipe(
            tapResponse({
              next: (items: InventoryItem[]) =>
                patchState(store, { items }, setLoaded()),
              error: (error: Error) =>
                patchState(store, setError(error.message)),
            }),
          ),
        ),
      ),
    ),
    loadSummary: rxMethod<void>(
      pipe(
        switchMap(() =>
          api.getSummary().pipe(
            tapResponse({
              next: (summary: InventorySummary) =>
                patchState(store, { summary }),
              error: () => {},
            }),
          ),
        ),
      ),
    ),
    createItem: rxMethod<CreateInventoryItemDto>(
      pipe(
        tap(() => patchState(store, setLoading())),
        switchMap((dto) =>
          api.create(dto).pipe(
            tapResponse({
              next: (item: InventoryItem) =>
                patchState(
                  store,
                  { items: [...store.items(), item] },
                  setLoaded(),
                ),
              error: (error: Error) =>
                patchState(store, setError(error.message)),
            }),
          ),
        ),
      ),
    ),
    updateItem: rxMethod<{ id: string; dto: UpdateInventoryItemDto }>(
      pipe(
        tap(() => patchState(store, setLoading())),
        switchMap(({ id, dto }) =>
          api.update(id, dto).pipe(
            tapResponse({
              next: (updated: InventoryItem) =>
                patchState(
                  store,
                  {
                    items: store
                      .items()
                      .map((i) => (i.id === id ? updated : i)),
                  },
                  setLoaded(),
                ),
              error: (error: Error) =>
                patchState(store, setError(error.message)),
            }),
          ),
        ),
      ),
    ),
    deleteItem: rxMethod<string>(
      pipe(
        tap(() => patchState(store, setLoading())),
        switchMap((id) =>
          api.delete(id).pipe(
            tapResponse({
              next: () =>
                patchState(
                  store,
                  {
                    items: store.items().filter((i) => i.id !== id),
                  },
                  setLoaded(),
                ),
              error: (error: Error) =>
                patchState(store, setError(error.message)),
            }),
          ),
        ),
      ),
    ),
    setFilters: (filters: {
      type?: string;
      system?: string;
      manufacturer?: string;
    }) => patchState(store, { filters }),
    clearError: () => patchState(store, setLoaded()),
  })),
);
