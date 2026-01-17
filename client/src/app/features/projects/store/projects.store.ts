import { computed, inject } from "@angular/core";
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from "@ngrx/signals";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { pipe, switchMap, tap, catchError, of } from "rxjs";
import { tapResponse } from "@ngrx/operators";
import { ProjectsApiService } from "../services/projects-api.service";
import type {
  Project,
  CreateProjectDto,
  UpdateProjectDto,
  ProjectStats,
} from "../models/project.model";

interface ProjectsState {
  projects: Project[];
  selectedProject: Project | null;
  stats: ProjectStats | null;
  loading: boolean;
  error: string | null;
}

const initialState: ProjectsState = {
  projects: [],
  selectedProject: null,
  stats: null,
  loading: false,
  error: null,
};

export const ProjectsStore = signalStore(
  { providedIn: "root" },
  withState(initialState),
  withComputed((store) => ({
    projectCount: computed(() => store.projects().length),
    draftProjects: computed(() =>
      store.projects().filter((p) => p.status === "draft")
    ),
    completedProjects: computed(() =>
      store.projects().filter((p) => p.status === "completed")
    ),
    totalArea: computed(() =>
      store.projects().reduce((sum, p) => sum + p.slabArea, 0)
    ),
  })),
  withMethods((store, api = inject(ProjectsApiService)) => ({
    loadProjects: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { loading: true, error: null })),
        switchMap(() =>
          api.getAll().pipe(
            tapResponse({
              next: (projects) =>
                patchState(store, { projects, loading: false }),
              error: (error: Error) =>
                patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),
    loadStats: rxMethod<void>(
      pipe(
        switchMap(() =>
          api.getStats().pipe(
            tapResponse({
              next: (stats) => patchState(store, { stats }),
              error: () => {},
            })
          )
        )
      )
    ),
    loadProject: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { loading: true })),
        switchMap((id) =>
          api.getById(id).pipe(
            tapResponse({
              next: (project) =>
                patchState(store, { selectedProject: project, loading: false }),
              error: (error: Error) =>
                patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),
    createProject: rxMethod<CreateProjectDto>(
      pipe(
        tap(() => patchState(store, { loading: true })),
        switchMap((dto) =>
          api.create(dto).pipe(
            tapResponse({
              next: (project) =>
                patchState(store, {
                  projects: [...store.projects(), project],
                  loading: false,
                }),
              error: (error: Error) =>
                patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),
    addProject: (project: Project) =>
      patchState(store, {
        projects: [project, ...store.projects()],
      }),
    updateProjectState: (updated: Project) =>
      patchState(store, {
        projects: store
          .projects()
          .map((p) => (p.id === updated.id ? updated : p)),
        selectedProject:
          store.selectedProject()?.id === updated.id
            ? updated
            : store.selectedProject(),
      }),
    updateProject: rxMethod<{ id: string; dto: UpdateProjectDto }>(
      pipe(
        tap(() => patchState(store, { loading: true })),
        switchMap(({ id, dto }) =>
          api.update(id, dto).pipe(
            tapResponse({
              next: (updated) =>
                patchState(store, {
                  projects: store
                    .projects()
                    .map((p) => (p.id === id ? updated : p)),
                  selectedProject:
                    store.selectedProject()?.id === id
                      ? updated
                      : store.selectedProject(),
                  loading: false,
                }),
              error: (error: Error) =>
                patchState(store, { error: error.message, loading: false }),
            })
          )
        )
      )
    ),
    deleteProject: rxMethod<string>(
      pipe(
        tap(() => patchState(store, { loading: true })),
        switchMap((id) =>
          api.delete(id).pipe(
            tapResponse({
              next: () =>
                patchState(store, {
                  projects: store.projects().filter((p) => p.id !== id),
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
    setSelectedProject: (project: Project | null) =>
      patchState(store, { selectedProject: project }),
  }))
);
