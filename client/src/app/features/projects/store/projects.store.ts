import { computed, inject, Injectable } from '@angular/core';
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
import { ProjectsApiService } from '../services/projects-api.service';
import {
  withDevtools,
  withCallState,
  setLoading,
  setLoaded,
  setError,
} from '@angular-architects/ngrx-toolkit';
import type {
  Project,
  CreateProjectDto,
  UpdateProjectDto,
  ProjectStats,
} from '../models/project.model';

interface ProjectsState {
  projects: Project[];
  selectedProject: Project | null;
  stats: ProjectStats | null;
  searchTerm: string;
  statusFilter: string | null;
}

const initialState: ProjectsState = {
  projects: [],
  selectedProject: null,
  stats: null,
  searchTerm: '',
  statusFilter: null,
};

@Injectable({ providedIn: 'root' })
export class ProjectsStore extends signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withDevtools('projectsStore'),
  withCallState(),
  withComputed((store) => ({
    projectCount: computed(() => store.projects().length),
    draftProjects: computed(() =>
      store.projects().filter((p) => p.status === 'draft'),
    ),
    completedProjects: computed(() =>
      store.projects().filter((p) => p.status === 'completed'),
    ),
    totalArea: computed(() =>
      store.projects().reduce((sum, p) => sum + p.slabArea, 0),
    ),
    filteredProjects: computed(() => {
      const projects = store.projects();
      const searchTerm = store.searchTerm();
      const statusFilter = store.statusFilter();
      let filtered = projects;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (p) =>
            p.name.toLowerCase().includes(term) ||
            p.id.toLowerCase().includes(term),
        );
      }

      if (statusFilter) {
        filtered = filtered.filter((p) => p.status === statusFilter);
      }

      return filtered;
    }),
  })),
  withMethods((store, api = inject(ProjectsApiService)) => ({
    loadProjects: rxMethod<void>(
      pipe(
        tap(() => patchState(store, setLoading())),
        switchMap(() =>
          api.getAll().pipe(
            tapResponse({
              next: (projects) => patchState(store, { projects }, setLoaded()),
              error: (error: any) => {
                patchState(store, setError(error.message));
              },
            }),
          ),
        ),
      ),
    ),
    loadStats: rxMethod<void>(
      pipe(
        switchMap(() =>
          api.getStats().pipe(
            tapResponse({
              next: (stats) => patchState(store, { stats }),
              error: (error: any) => {
                patchState(store, setError(error.message));
              },
            }),
          ),
        ),
      ),
    ),
    loadProject: rxMethod<string>(
      pipe(
        tap(() => patchState(store, setLoading())),
        switchMap((id) =>
          api.getById(id).pipe(
            tapResponse({
              next: (project) =>
                patchState(store, { selectedProject: project }, setLoaded()),
              error: (error: any) => {
                patchState(store, setError(error.message));
              },
            }),
          ),
        ),
      ),
    ),
    createProject: rxMethod<CreateProjectDto>(
      pipe(
        tap(() => patchState(store, setLoading())),
        switchMap((dto) =>
          api.create(dto).pipe(
            tapResponse({
              next: (project) =>
                patchState(
                  store,
                  {
                    projects: [...store.projects(), project],
                  },
                  setLoaded(),
                ),
              error: (error: any) => {
                patchState(store, setError(error.message));
              },
            }),
          ),
        ),
      ),
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
        tap(() => patchState(store, setLoading())),
        switchMap(({ id, dto }) =>
          api.update(id, dto).pipe(
            tapResponse({
              next: (updated) =>
                patchState(
                  store,
                  {
                    projects: store
                      .projects()
                      .map((p) => (p.id === id ? updated : p)),
                    selectedProject:
                      store.selectedProject()?.id === id
                        ? updated
                        : store.selectedProject(),
                  },
                  setLoaded(),
                ),
              error: (error: any) => {
                patchState(store, setError(error.message));
              },
            }),
          ),
        ),
      ),
    ),
    deleteProject: rxMethod<string>(
      pipe(
        tap(() => patchState(store, setLoading())),
        switchMap((id) =>
          api.delete(id).pipe(
            tapResponse({
              next: () =>
                patchState(
                  store,
                  {
                    projects: store.projects().filter((p) => p.id !== id),
                  },
                  setLoaded(),
                ),
              error: (error: any) => {
                patchState(store, setError(error.message));
              },
            }),
          ),
        ),
      ),
    ),
    setSearchTerm: (searchTerm: string) => patchState(store, { searchTerm }),
    setStatusFilter: (statusFilter: string | null) =>
      patchState(store, { statusFilter }),
    clearError: () => patchState(store, setLoaded()),
    setSelectedProject: (project: Project | null) =>
      patchState(store, { selectedProject: project }),
  })),
) {}
