import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '@env/environment';

import type {
  Project,
  CreateProjectDto,
  UpdateProjectDto,
  ProjectStats,
  EditorData,
} from '@models/project.model';
import type { CadData } from '@models/cad.models';
import { ApiResponse, PaginatedData } from '@models/api-response.model';

/**
 * Pure HTTP service for Projects API calls.
 * State management is handled by ProjectsStore.
 */
@Injectable({ providedIn: 'root' })
export class ProjectsApiService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/projects`;

  /**
   * Get all projects for the current user
   * Backend returns paginated response wrapped in ApiResponse
   */
  public getAll(): Observable<Project[]> {
    return this.http
      .get<ApiResponse<PaginatedData<Project>>>(this.API_URL)
      .pipe(map((res) => res.data.data));
  }

  /**
   * Get project by ID
   */
  public getById(id: string): Observable<Project> {
    return this.http
      .get<ApiResponse<Project>>(`${this.API_URL}/${id}`)
      .pipe(map((res) => res.data));
  }

  /**
   * Get project statistics
   */
  public getStats(): Observable<ProjectStats> {
    return this.http
      .get<ApiResponse<ProjectStats>>(`${this.API_URL}/stats`)
      .pipe(map((res) => res.data));
  }

  /**
   * Create new project
   */
  public create(dto: CreateProjectDto): Observable<Project> {
    return this.http
      .post<ApiResponse<Project>>(this.API_URL, dto)
      .pipe(map((res) => res.data));
  }

  /**
   * Update existing project
   */
  public update(id: string, dto: UpdateProjectDto): Observable<Project> {
    return this.http
      .put<ApiResponse<Project>>(`${this.API_URL}/${id}`, dto)
      .pipe(map((res) => res.data));
  }

  /**
   * Delete project
   */
  public delete(id: string): Observable<void> {
    return this.http
      .delete<ApiResponse<{ message: string }>>(`${this.API_URL}/${id}`)
      .pipe(map(() => void 0));
  }

  /**
   * Save calculation result
   */
  public saveCalculation(id: string, result: unknown): Observable<Project> {
    return this.http
      .post<ApiResponse<Project>>(`${this.API_URL}/${id}/calculation`, {
        result,
      })
      .pipe(map((res) => res.data));
  }

  /**
   * Save optimization result
   */
  public saveOptimization(id: string, result: unknown): Observable<Project> {
    return this.http
      .post<ApiResponse<Project>>(`${this.API_URL}/${id}/optimization`, {
        result,
      })
      .pipe(map((res) => res.data));
  }

  /**
   * Get editor data for project
   */
  public getEditorData(projectId: string): Observable<EditorData | null> {
    return this.http
      .get<
        ApiResponse<EditorData | null>
      >(`${this.API_URL}/${projectId}/editor-data`)
      .pipe(map((res) => res.data));
  }

  /**
   * Save editor data for project
   */
  public updateEditorData(
    projectId: string,
    data: EditorData,
  ): Observable<Project> {
    return this.http
      .put<
        ApiResponse<Project>
      >(`${this.API_URL}/${projectId}/editor-data`, data)
      .pipe(map((res) => res.data));
  }

  /**
   * Upload PDF file for a project
   */
  public uploadPdf(
    projectId: string,
    file: File,
  ): Observable<{
    paths?: { pdf?: string; dxf?: string; json?: string };
    sourceFile?: string;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post<
        ApiResponse<{
          paths?: { pdf?: string; dxf?: string; json?: string };
          sourceFile?: string;
        }>
      >(`${environment.apiUrl}/pdf/upload/${projectId}`, formData)
      .pipe(map((res) => res.data));
  }

  /**
   * Get CAD data formatted for Fabric.js
   */
  public getCadData(projectId: string): Observable<CadData | null> {
    return this.http
      .get<ApiResponse<CadData | null>>(`${this.API_URL}/${projectId}/cad-data`)
      .pipe(map((res) => res.data));
  }
}
