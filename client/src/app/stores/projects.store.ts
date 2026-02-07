import { computed, inject, Injectable } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, of, catchError, map } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import { ProjectsApiService } from '@api/projects-api.service';
import {
  withDevtools,
  withCallState,
  withStorageSync,
  setLoading,
  setLoaded,
  setError,
} from '@angular-architects/ngrx-toolkit';
import type {
  Project,
  CreateProjectDto,
  UpdateProjectDto,
  ProjectStats,
} from '@models/project.model';

/**
 * Upload state for PDF processing
 */
interface UploadState {
  isUploading: boolean;
  uploadProgress: number;
  uploadedPaths: {
    pdf?: string;
    dxf?: string;
    json?: string;
  } | null;
}

/**
 * Creation state for new project workflow
 */
interface CreationState {
  isCreating: boolean;
  creationStep: 'idle' | 'creating' | 'uploading' | 'complete';
  creationProgress: number;
  createdProject: Project | null;
  extractedGeometry: unknown | null;
}

interface ProjectsState {
  projects: Project[];
  selectedProject: Project | null;
  stats: ProjectStats | null;
  searchTerm: string;
  statusFilter: string | null;
  upload: UploadState;
  creation: CreationState;
}

const initialUploadState: UploadState = {
  isUploading: false,
  uploadProgress: 0,
  uploadedPaths: null,
};

const initialCreationState: CreationState = {
  isCreating: false,
  creationStep: 'idle',
  creationProgress: 0,
  createdProject: null,
  extractedGeometry: null,
};

const initialState: ProjectsState = {
  projects: [],
  selectedProject: null,
  stats: null,
  searchTerm: '',
  statusFilter: null,
  upload: initialUploadState,
  creation: initialCreationState,
};

@Injectable({ providedIn: 'root' })
export class ProjectsStore extends signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withStorageSync({
    key: 'projectsState',
    select: (state: ProjectsState) => ({
      searchTerm: state.searchTerm,
      statusFilter: state.statusFilter,
    }),
  }),
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
    // Upload state selectors
    isUploading: computed(() => store.upload().isUploading),
    uploadProgress: computed(() => store.upload().uploadProgress),
    uploadedPaths: computed(() => store.upload().uploadedPaths),
    // Creation state selectors
    isCreating: computed(() => store.creation().isCreating),
    creationStep: computed(() => store.creation().creationStep),
    creationProgress: computed(() => store.creation().creationProgress),
    createdProject: computed(() => store.creation().createdProject),
    extractedGeometry: computed(() => store.creation().extractedGeometry),
  })),
  withMethods((store, api = inject(ProjectsApiService)) => ({
    loadProjects: rxMethod<void>(
      pipe(
        tap(() => patchState(store, setLoading())),
        switchMap(() =>
          api.getAll().pipe(
            tapResponse({
              next: (projects) => patchState(store, { projects }, setLoaded()),
              error: (error: Error) => {
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
              error: (error: Error) => {
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
              error: (error: Error) => {
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
              error: (error: Error) => {
                patchState(store, setError(error.message));
              },
            }),
          ),
        ),
      ),
    ),
    addProject: (project: Project): void =>
      patchState(store, {
        projects: [project, ...store.projects()],
      }),
    updateProjectState: (updated: Project): void =>
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
              error: (error: Error) => {
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
              error: (error: Error) => {
                patchState(store, setError(error.message));
              },
            }),
          ),
        ),
      ),
    ),
    setSearchTerm: (searchTerm: string): void =>
      patchState(store, { searchTerm }),
    setStatusFilter: (statusFilter: string | null): void =>
      patchState(store, { statusFilter }),
    clearError: (): void => patchState(store, setLoaded()),
    setSelectedProject: (project: Project | null): void =>
      patchState(store, { selectedProject: project }),

    // Upload PDF for a project (or temp project)
    uploadPdf: rxMethod<{ projectId: string; file: File }>(
      pipe(
        tap(() =>
          patchState(store, {
            upload: {
              isUploading: true,
              uploadProgress: 0,
              uploadedPaths: null,
            },
          }),
        ),
        switchMap(({ projectId, file }) =>
          api.uploadPdf(projectId, file).pipe(
            tapResponse({
              next: (data) => {
                const paths = {
                  pdf: data.paths?.pdf || data.sourceFile,
                  dxf: data.paths?.dxf,
                  json: data.paths?.json,
                };
                patchState(store, {
                  upload: {
                    isUploading: false,
                    uploadProgress: 100,
                    uploadedPaths: paths,
                  },
                });
              },
              error: (error: Error) => {
                patchState(store, {
                  upload: initialUploadState,
                });
                patchState(store, setError(error.message));
              },
            }),
          ),
        ),
      ),
    ),

    // Full project creation workflow (DXF: upload → create project → attach paths)
    createProjectWithPdf: rxMethod<{
      dto: CreateProjectDto;
      uploadedPaths?: { pdf?: string; dxf?: string; json?: string };
    }>(
      pipe(
        tap(() =>
          patchState(store, {
            creation: {
              isCreating: true,
              creationStep: 'creating',
              creationProgress: 20,
              createdProject: null,
              extractedGeometry: null,
            },
          }),
        ),
        switchMap(({ dto, uploadedPaths }) =>
          api.create(dto).pipe(
            switchMap((project) => {
              patchState(store, {
                projects: [project, ...store.projects()],
                creation: {
                  ...store.creation(),
                  createdProject: project,
                  creationProgress: 40,
                },
              });

              if (
                uploadedPaths &&
                (uploadedPaths.pdf || uploadedPaths.dxf || uploadedPaths.json)
              ) {
                return api
                  .update(project.id, {
                    sourcePdfPath: uploadedPaths.pdf,
                    dxfPath: uploadedPaths.dxf,
                    geoJsonPath: uploadedPaths.json,
                  })
                  .pipe(
                    map((updated) => {
                      patchState(store, {
                        projects: store
                          .projects()
                          .map((p) => (p.id === updated.id ? updated : p)),
                        creation: {
                          ...store.creation(),
                          creationStep: 'complete',
                          creationProgress: 100,
                          createdProject: updated,
                        },
                      });
                      return updated;
                    }),
                    catchError(() => {
                      patchState(store, {
                        creation: {
                          ...store.creation(),
                          creationStep: 'complete',
                          creationProgress: 100,
                        },
                      });
                      return of(project);
                    }),
                  );
              }

              patchState(store, {
                creation: {
                  ...store.creation(),
                  creationStep: 'complete',
                  creationProgress: 100,
                },
              });
              return of(project);
            }),
            tapResponse({
              next: () => {
                patchState(store, setLoaded());
              },
              error: (error: Error) => {
                patchState(store, {
                  creation: initialCreationState,
                });
                patchState(store, setError(error.message));
              },
            }),
          ),
        ),
      ),
    ),

    // Reset upload state
    resetUpload: (): void =>
      patchState(store, {
        upload: initialUploadState,
      }),

    // Reset creation state
    resetCreation: (): void =>
      patchState(store, {
        creation: initialCreationState,
      }),
  })),
) {}
