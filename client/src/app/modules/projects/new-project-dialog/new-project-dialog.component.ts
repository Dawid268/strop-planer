import {
  Component,
  inject,
  signal,
  computed,
  effect,
  ChangeDetectionStrategy,
  PLATFORM_ID,
  isDevMode,
  OnDestroy,
} from "@angular/core";
import { isPlatformBrowser, CommonModule } from "@angular/common";
import { Router } from "@angular/router";
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

import { ProjectsStore } from "@stores/projects.store";
import { CreateProjectDto } from "@models/project.model";

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
export class NewProjectDialogComponent implements OnDestroy {
  protected readonly ref = inject(DynamicDialogRef);
  protected readonly store = inject(ProjectsStore);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly messageService = inject(MessageService);
  private readonly router = inject(Router);
  private readonly translocoService = inject(TranslocoService);

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
  protected readonly isDragging = signal(false);
  protected readonly localError = signal<string | null>(null);

  // Computed from store state
  protected readonly isUploading = this.store.isUploading;
  protected readonly isCreating = this.store.isCreating;
  protected readonly creationProgress = this.store.creationProgress;

  protected readonly creationStatus = computed(() => {
    const step = this.store.creationStep();
    switch (step) {
      case "creating":
        return this.translocoService.translate("projects.new.status.creating");
      case "uploading":
        return this.translocoService.translate("projects.new.status.uploading");
      case "complete":
        return this.translocoService.translate("projects.new.status.ready");
      default:
        return "";
    }
  });

  constructor() {
    // Effect to handle upload completion
    effect(() => {
      const paths = this.store.uploadedPaths();
      if (paths) {
        this.project.update((p) => ({
          ...p,
          sourcePdfPath: paths.pdf || p.sourcePdfPath,
          dxfPath: paths.dxf || p.dxfPath,
          geoJsonPath: paths.json || p.geoJsonPath,
        }));
      }
    });

    // Effect to handle creation completion (project has paths from upload → DXF)
    effect(() => {
      const step = this.store.creationStep();
      const createdProject = this.store.createdProject();

      if (step === "complete" && createdProject) {
        setTimeout(() => {
          this.ref.close(createdProject);
          this.router.navigate(["/projects", createdProject.id, "editor"], {
            state: { project: createdProject },
          });
        }, 500);
      }
    });

    // Effect to handle store errors
    effect(() => {
      const error = this.store.error?.();
      if (error) {
        this.messageService.add({
          severity: "error",
          summary: this.translocoService.translate("common.error"),
          detail: error,
        });
      }
    });

    // Load dev PDF in dev mode
    if (isDevMode() && isPlatformBrowser(this.platformId)) {
      this.loadDevPdf();
    }
  }

  public ngOnDestroy(): void {
    this.store.resetUpload();
    this.store.resetCreation();
  }

  public updateName(name: string): void {
    this.project.update((p) => ({ ...p, name }));
  }

  public updateDescription(description: string): void {
    this.project.update((p) => ({ ...p, description }));
  }

  private async loadDevPdf(): Promise<void> {
    try {
      const response = await fetch("assets/strop-dev.pdf");
      if (!response.ok) return;

      const blob = await response.blob();
      const file = new File([blob], "strop-dev.pdf", {
        type: "application/pdf",
      });
      this.handleFile(file);
    } catch {
      // Dev PDF not available or failed to load
    }
  }

  public onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  public onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  public onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0 && files[0].type === "application/pdf") {
      this.handleFile(files[0]);
    }
  }

  public onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  private handleFile(file: File): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.selectedPdfFiles.set([file]);

    if (!this.project().name) {
      this.project.update((p) => ({
        ...p,
        name: file.name.replace(".pdf", ""),
      }));
    }

    const tempId = "temp_" + Date.now();
    this.store.uploadPdf({ projectId: tempId, file });
  }

  public isValid(): boolean {
    return !!this.project().name && this.selectedPdfFiles().length > 0;
  }

  public submit(): void {
    if (!this.isValid()) {
      if (!this.project().name) {
        this.localError.set(
          this.translocoService.translate("projects.new.errors.nameRequired"),
        );
      }
      return;
    }
    this.localError.set(null);

    const dto = this.project();
    const uploadedPaths = this.store.uploadedPaths() ?? undefined;

    this.store.createProjectWithPdf({ dto, uploadedPaths });
  }
}
