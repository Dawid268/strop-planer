import { inject } from "@angular/core";
import { signalStore, withState, withMethods, patchState } from "@ngrx/signals";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { pipe, switchMap, tap, forkJoin } from "rxjs";
import { tapResponse } from "@ngrx/operators";
import { ProjectsApiService } from "../../projects/services/projects-api.service";
import { InventoryApiService } from "../../inventory/services/inventory-api.service";
import type {
  Project,
  ProjectStats,
} from "../../projects/models/project.model";
import type { InventorySummary } from "../../inventory/models/inventory.model";

interface DashboardState {
  projectStats: ProjectStats | null;
  inventorySummary: InventorySummary | null;
  recentProjects: Project[];
  loading: boolean;
  error: string | null;
}

const initialState: DashboardState = {
  projectStats: null,
  inventorySummary: null,
  recentProjects: [],
  loading: false,
  error: null,
};

export const DashboardStore = signalStore(
  { providedIn: "root" },
  withState(initialState),
  withMethods(
    (
      store,
      projectsApi = inject(ProjectsApiService),
      inventoryApi = inject(InventoryApiService)
    ) => ({
      loadDashboard: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { loading: true, error: null })),
          switchMap(() =>
            forkJoin({
              stats: projectsApi.getStats(),
              projects: projectsApi.getAll(),
              inventory: inventoryApi.getSummary(),
            }).pipe(
              tapResponse({
                next: (result: {
                  stats: ProjectStats;
                  projects: Project[];
                  inventory: InventorySummary;
                }) =>
                  patchState(store, {
                    projectStats: result.stats,
                    recentProjects: result.projects.slice(0, 5),
                    inventorySummary: result.inventory,
                    loading: false,
                  }),
                error: (error: Error) =>
                  patchState(store, { error: error.message, loading: false }),
              })
            )
          )
        )
      ),
      clearError: () => patchState(store, { error: null }),
    })
  )
);
