import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, timer } from "rxjs";
import { switchMap, takeWhile, tap } from "rxjs/operators";
import { ProjectsStore } from "../store/projects.store";
import type {
  Project,
  CreateProjectDto,
  UpdateProjectDto,
  Job,
} from "../models/project.model";
import { ProjectsApiService } from "./projects-api.service";
import { environment } from "../../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class ProjectsService {
  private readonly api = inject(ProjectsApiService);
  private readonly http = inject(HttpClient);
  private readonly store = inject(ProjectsStore);

  public getProjects(): Observable<Project[]> {
    return this.api.getAll();
  }

  public create(dto: CreateProjectDto): Observable<Project> {
    console.log("DEBUG: create called", dto);
    return this.api
      .create(dto)
      .pipe(tap((project: Project) => this.store.addProject(project)));
  }

  public update(id: string, dto: UpdateProjectDto): Observable<Project> {
    return this.api
      .update(id, dto)
      .pipe(tap((project: Project) => this.store.updateProjectState(project)));
  }

  public delete(id: string): Observable<void> {
    return this.api.delete(id).pipe(tap(() => this.store.deleteProject(id)));
  }

  public getById(id: string): Observable<Project> {
    return this.api.getById(id);
  }

  public extractGeometry(pdfPath: string, projectId: string): Observable<Job> {
    console.log("DEBUG: extractGeometry called DEFINED", {
      pdfPath,
      projectId,
    });
    return this.http
      .post<{ jobId: string }>(`${environment.apiUrl}/geometry/extract`, {
        pdfPath,
        projectId,
      })
      .pipe(
        switchMap((res) => {
          const jobId = res.jobId;
          console.log(`DEBUG: Extraction job started with ID: ${jobId}`);

          return timer(0, 2000).pipe(
            tap(() => console.log(`DEBUG: Polling job status for ${jobId}...`)),
            switchMap(() =>
              this.http
                .get<Job>(`${environment.apiUrl}/geometry/jobs/${jobId}`)
                .pipe(
                  tap((job) => console.log(`DEBUG: Job status received:`, job)),
                ),
            ),
            takeWhile((job) => {
              const isProcessing =
                job.status === "pending" || job.status === "processing";
              if (!isProcessing) {
                console.log(
                  `DEBUG: Job finished with status: ${job.status}`,
                  job,
                );
              }
              return isProcessing;
            }, true),
          );
        }),
      );
  }

  uploadPdf(projectId: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append("file", file);
    return this.http.post(
      `${environment.apiUrl}/pdf/upload/${projectId}`,
      formData,
    );
  }
}
