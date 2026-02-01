import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import type {
  Project,
  CreateProjectDto,
  UpdateProjectDto,
  ProjectStats,
} from "../models/project.model";
import { environment } from "../../../../environments/environment";
import { ApiResponse } from "@core/models/api-response.model";

@Injectable({ providedIn: "root" })
export class ProjectsApiService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/projects`;

  public getAll(): Observable<Project[]> {
    return this.http
      .get<ApiResponse<Project[]>>(this.API_URL)
      .pipe(map((res) => res.data));
  }

  public getById(id: string): Observable<Project> {
    return this.http
      .get<ApiResponse<Project>>(`${this.API_URL}/${id}`)
      .pipe(map((res) => res.data));
  }

  public getStats(): Observable<ProjectStats> {
    return this.http
      .get<ApiResponse<ProjectStats>>(`${this.API_URL}/stats`)
      .pipe(map((res) => res.data));
  }

  public create(dto: CreateProjectDto): Observable<Project> {
    return this.http
      .post<ApiResponse<Project>>(this.API_URL, dto)
      .pipe(map((res) => res.data));
  }

  public update(id: string, dto: UpdateProjectDto): Observable<Project> {
    return this.http
      .put<ApiResponse<Project>>(`${this.API_URL}/${id}`, dto)
      .pipe(map((res) => res.data));
  }

  public delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }

  public saveCalculation(id: string, result: any): Observable<Project> {
    return this.http
      .post<ApiResponse<Project>>(`${this.API_URL}/${id}/calculation`, {
        result,
      })
      .pipe(map((res) => res.data));
  }

  public saveOptimization(id: string, result: any): Observable<Project> {
    return this.http
      .post<ApiResponse<Project>>(`${this.API_URL}/${id}/optimization`, {
        result,
      })
      .pipe(map((res) => res.data));
  }
}
