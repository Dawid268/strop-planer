import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import type {
  Project,
  CreateProjectDto,
  UpdateProjectDto,
  ProjectStats,
} from "../models/project.model";
import { environment } from "../../../../environments/environment";

@Injectable({ providedIn: "root" })
export class ProjectsApiService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/projects`;

  public getAll(): Observable<Project[]> {
    return this.http.get<Project[]>(this.API_URL);
  }

  public getById(id: string): Observable<Project> {
    return this.http.get<Project>(`${this.API_URL}/${id}`);
  }

  public getStats(): Observable<ProjectStats> {
    return this.http.get<ProjectStats>(`${this.API_URL}/stats`);
  }

  public create(dto: CreateProjectDto): Observable<Project> {
    return this.http.post<Project>(this.API_URL, dto);
  }

  public update(id: string, dto: UpdateProjectDto): Observable<Project> {
    return this.http.put<Project>(`${this.API_URL}/${id}`, dto);
  }

  public delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }

  public saveCalculation(id: string, result: any): Observable<Project> {
    return this.http.post<Project>(`${this.API_URL}/${id}/calculation`, {
      result,
    });
  }

  public saveOptimization(id: string, result: any): Observable<Project> {
    return this.http.post<Project>(`${this.API_URL}/${id}/optimization`, {
      result,
    });
  }
}
