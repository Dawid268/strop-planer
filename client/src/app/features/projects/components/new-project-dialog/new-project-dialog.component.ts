import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
  PLATFORM_ID,
  ChangeDetectorRef,
  DestroyRef,
  isDevMode,
} from "@angular/core";
import { isPlatformBrowser, CommonModule } from "@angular/common";
import { DynamicDialogRef } from "primeng/dynamicdialog";
import { ButtonModule } from "primeng/button";
import { InputTextModule } from "primeng/inputtext";
import { TextareaModule } from "primeng/textarea";
import { ProgressBarModule } from "primeng/progressbar";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { MessageService } from "primeng/api";
import { ToastModule } from "primeng/toast";
import { MessageModule } from "primeng/message";
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";
import { FormsModule } from "@angular/forms";
import { ProjectsService } from "../../services/projects.service";
import { CreateProjectDto } from "../../models/project.model";
import { Router } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

@Component({
  selector: "app-new-project-dialog",
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    ProgressBarModule,
    ProgressSpinnerModule,
    ToastModule,
    MessageModule,
    FormsModule,
    TranslocoModule,
  ],
  providers: [MessageService],
  templateUrl: "./new-project-dialog.component.html",
  styleUrls: ["./new-project-dialog.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewProjectDialogComponent {
  protected readonly ref = inject(DynamicDialogRef);
  private readonly projectsService = inject(ProjectsService);
  private readonly platformId = inject(PLATFORM_ID);
  protected readonly cdr = inject(ChangeDetectorRef);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);
  private readonly translocoService = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly project = signal<CreateProjectDto>({
    name: "",
    description: "",
    slabLength: 10,
    slabWidth: 10,
    slabThickness: 0.2,
    floorHeight: 3.0,
    slabType: "monolityczny",
    formworkSystem: "",
    sourcePdfPath: "",
  });

  protected readonly selectedPdfFiles = signal<File[]>([]);
  protected readonly isUploading = signal(false);
  protected readonly isDragging = signal(false);

  // Creation state
  protected readonly isCreating = signal(false);
  protected readonly creationStatus = signal("");
  protected readonly creationProgress = signal(0);
  protected readonly error = signal<string | null>(null);

  updateName(name: string) {
    this.project.update((p) => ({ ...p, name }));
  }

  updateDescription(description: string) {
    this.project.update((p) => ({ ...p, description }));
  }

  constructor() {
    if (isDevMode() && isPlatformBrowser(this.platformId)) {
      this.loadDevPdf();
    }
  }

  private async loadDevPdf() {
    try {
      const response = await fetch("assets/strop-dev.pdf");
      const blob = await response.blob();
      const file = new File([blob], "strop-dev.pdf", {
        type: "application/pdf",
      });
      this.handleFile(file);
    } catch (e) {
      console.warn("Could not load dev PDF", e);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0 && files[0].type === "application/pdf") {
      this.handleFile(files[0]);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  private handleFile(file: File) {
    if (!isPlatformBrowser(this.platformId)) return;

    this.selectedPdfFiles.set([file]);
    this.isUploading.set(true);

    if (!this.project().name) {
      this.project.update((p) => ({
        ...p,
        name: file.name.replace(".pdf", ""),
      }));
    }

    const tempId = "temp_" + Date.now();

    this.projectsService
      .uploadPdf(tempId, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          // res is ApiResponse<any>
          const data = res.data;
          this.project.update((p) => ({
            ...p,
            sourcePdfPath:
              data.paths?.pdf || data.sourceFile || p.sourcePdfPath,
            dxfPath: data.paths?.dxf || p.dxfPath,
            geoJsonPath: data.paths?.json || p.geoJsonPath,
          }));
          this.isUploading.set(false);
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error("Upload failed", err);
          this.isUploading.set(false);
          this.messageService.add({
            severity: "error",
            summary: this.translocoService.translate("common.error"),
            detail: this.translocoService.translate(
              "projects.new.errors.uploadFailed",
            ),
          });
          this.cdr.detectChanges();
        },
      });
  }

  isValid(): boolean {
    return !!this.project().name && this.selectedPdfFiles().length > 0;
  }

  submit() {
    if (!this.isValid()) {
      if (!this.project().name) {
        this.error.set(
          this.translocoService.translate("projects.new.errors.nameRequired"),
        );
      }
      return;
    }
    this.error.set(null);

    this.isCreating.set(true);
    this.creationStatus.set(
      this.translocoService.translate("projects.new.status.creating"),
    );
    this.creationProgress.set(10);
    this.cdr.detectChanges();

    this.projectsService
      .create(this.project())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (project) => {
          this.creationProgress.set(40);

          if (this.project().sourcePdfPath) {
            this.creationStatus.set(
              this.translocoService.translate("projects.new.status.extracting"),
            );
            this.cdr.detectChanges();

            this.projectsService
              .extractGeometry(this.project().sourcePdfPath!, project.id)
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: (job) => {
                  this.creationProgress.set(100);
                  this.creationStatus.set(
                    this.translocoService.translate(
                      "projects.new.status.ready",
                    ),
                  );
                  this.cdr.detectChanges();

                  const geometryData = job.result || null;

                  setTimeout(() => {
                    const projectWithGeometry = {
                      ...project,
                      extractedSlabGeometry: geometryData,
                    };
                    this.ref.close(projectWithGeometry);
                    this.router.navigate(["/projects", project.id, "editor"], {
                      state: { extractedGeometry: geometryData },
                    });
                  }, 500);
                },
                error: (err) => {
                  console.error("Extraction failed", err);
                  this.messageService.add({
                    severity: "warn",
                    summary: this.translocoService.translate("common.warning"),
                    detail: this.translocoService.translate(
                      "projects.new.errors.extractionFailed",
                    ),
                  });
                  this.ref.close(project);
                  this.router.navigate(["/projects", project.id, "editor"]);
                },
              });
          } else {
            this.creationProgress.set(100);
            this.ref.close(project);
            this.router.navigate(["/projects", project.id, "editor"]);
          }
        },
        error: (err) => {
          console.error("Project creation failed", err);
          this.isCreating.set(false);
          this.error.set(
            this.translocoService.translate(
              "projects.new.errors.creationFailed",
            ),
          );
          this.messageService.add({
            severity: "error",
            summary: this.translocoService.translate("common.error"),
            detail: this.translocoService.translate(
              "projects.new.errors.saveFailed",
            ),
          });
          this.cdr.detectChanges();
        },
      });
  }
}
