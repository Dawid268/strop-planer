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
import { environment } from "../../../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class ProjectsService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(ProjectsStore);

  constructor() {
    console.log(
      "DEBUG: ProjectsService initialized - RE-VERIFY EXTRACT " + Date.now()
    );
  }

  public getProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(`${environment.apiUrl}/projects`);
  }

  public create(dto: CreateProjectDto): Observable<Project> {
    console.log("DEBUG: create called", dto);
    return this.http
      .post<Project>(`${environment.apiUrl}/projects`, dto)
      .pipe(tap((project: Project) => this.store.addProject(project)));
  }

  public update(id: string, dto: UpdateProjectDto): Observable<Project> {
    return this.http
      .patch<Project>(`${environment.apiUrl}/projects/${id}`, dto)
      .pipe(tap((project: Project) => this.store.updateProjectState(project)));
  }

  public delete(id: string): Observable<void> {
    return this.http
      .delete<void>(`${environment.apiUrl}/projects/${id}`)
      .pipe(tap(() => this.store.deleteProject(id)));
  }

  public getOne(id: string): Observable<Project> {
    return this.http.get<Project>(`${environment.apiUrl}/projects/${id}`);
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
                  tap((job) => console.log(`DEBUG: Job status received:`, job))
                )
            ),
            takeWhile((job) => {
              const isProcessing =
                job.status === "pending" || job.status === "processing";
              if (!isProcessing) {
                console.log(
                  `DEBUG: Job finished with status: ${job.status}`,
                  job
                );
              }
              return isProcessing;
            }, true)
          );
        })
      );
  }

  uploadPdf(projectId: string, file: File): Observable<any> {
    const formData = new FormData();
    formData.append("file", file);
    return this.http.post(
      `${environment.apiUrl}/pdf/upload/${projectId}`,
      formData
    );
  }
}
