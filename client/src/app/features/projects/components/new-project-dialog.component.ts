import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
  PLATFORM_ID,
  ChangeDetectorRef,
} from "@angular/core";
import { isPlatformBrowser, CommonModule } from "@angular/common";
import { DynamicDialogRef } from "primeng/dynamicdialog";
import { ButtonModule } from "primeng/button";
import { InputTextModule } from "primeng/inputtext";
import { Textarea } from "primeng/textarea";
import { ProgressBarModule } from "primeng/progressbar";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { MessageService } from "primeng/api";
import { ToastModule } from "primeng/toast";
import { MessageModule } from "primeng/message";
import { FormsModule } from "@angular/forms";
import { ProjectsService } from "../services/projects.service";
import { CreateProjectDto } from "../models/project.model";
import { Router } from "@angular/router";

@Component({
  selector: "app-new-project-dialog",
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    InputTextModule,
    Textarea,
    ProgressBarModule,
    ProgressSpinnerModule,
    ToastModule,
    MessageModule,
    FormsModule,
  ],
  providers: [MessageService],
  template: `
    <div class="flex flex-column gap-4 p-1">
      <div
        class="file-upload-area relative border-2 border-dashed border-300 border-round-lg p-6 transition-colors transition-duration-200"
        (click)="fileInput.click()"
        (drop)="onDrop($event)"
        (dragover)="onDragOver($event)"
        [class.surface-hover]="isDragging()"
        [class.border-primary]="isDragging()"
      >
        @if (isUploading()) {
          <div
            class="absolute inset-0 bg-white-alpha-80 z-10 flex flex-column align-items-center justify-content-center"
          >
            <p-progressSpinner
              styleClass="w-3rem h-3rem"
              strokeWidth="4"
            ></p-progressSpinner>
            <p class="mt-2 text-sm text-600 font-medium">
              Przetwarzanie pliku...
            </p>
          </div>
        }

        <input
          #fileInput
          type="file"
          (change)="onFileSelected($event)"
          accept=".pdf"
          hidden
        />

        <div
          class="flex flex-column align-items-center justify-content-center text-center cursor-pointer"
        >
          @if (selectedPdfFiles().length > 0) {
            <i class="pi pi-check-circle text-green-500 text-5xl mb-3"></i>
            <p class="font-bold text-900 m-0">
              {{ selectedPdfFiles()[0].name }}
            </p>
            <p class="text-xs text-500 mt-2">Kliknij, aby zmienić plik</p>
          } @else {
            <i class="pi pi-cloud-upload text-400 text-5xl mb-3"></i>
            <p class="font-bold text-900 m-0">
              Przeciągnij plik PDF lub kliknij
            </p>
            <p class="text-xs text-500 mt-2">Obsługiwane formaty: PDF</p>
          }
        </div>
      </div>

      <div class="flex flex-column gap-3">
        <div class="flex flex-column gap-2">
          <label for="name" class="font-medium text-900">Nazwa projektu</label>
          <input
            id="name"
            pInputText
            [(ngModel)]="project.name"
            name="name"
            required
            placeholder="np. Budynek mieszkalny A"
            class="w-full"
          />
        </div>

        <div class="flex flex-column gap-2">
          <label for="description" class="font-medium text-900"
            >Opis (opcjonalnie)</label
          >
          <textarea
            id="description"
            pInputTextarea
            [(ngModel)]="project.description"
            name="description"
            [autoResize]="true"
            rows="3"
            class="w-full"
          ></textarea>
        </div>
      </div>

      <!-- Creation Progress Overlay -->
      @if (isCreating()) {
        <div
          class="creation-overlay p-4 bg-blue-50 border-round border-1 border-blue-200 mt-2"
        >
          <div class="flex justify-content-between mb-2">
            <span class="text-sm font-bold text-blue-700">{{
              creationStatus()
            }}</span>
            <span class="text-sm font-bold text-blue-700"
              >{{ creationProgress() }}%</span
            >
          </div>
          <p-progressBar
            [value]="creationProgress()"
            [showValue]="false"
            styleClass="h-1rem border-round"
          ></p-progressBar>
        </div>
      }
      @if (error()) {
        <p-message
          severity="error"
          [text]="error() || ''"
          styleClass="w-full mt-2"
        ></p-message>
      }

      <div class="flex justify-content-end gap-2 mt-4">
        <button
          pButton
          label="Anuluj"
          class="p-button-text p-button-secondary font-bold"
          (click)="ref.close()"
          [disabled]="isCreating() || isUploading()"
        ></button>
        <button
          pButton
          label="Utwórz projekt"
          class="font-bold px-4"
          (click)="submit()"
          [loading]="isCreating()"
        ></button>
      </div>
    </div>
    <p-toast></p-toast>
  `,
  styles: [
    `
      .file-upload-area {
        min-height: 200px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewProjectDialogComponent {
  public ref = inject(DynamicDialogRef);
  public projectsService = inject(ProjectsService);
  private platformId = inject(PLATFORM_ID);
  public cdr = inject(ChangeDetectorRef);
  private messageService = inject(MessageService);
  private router = inject(Router);

  project: CreateProjectDto = {
    name: "",
    description: "",
    slabLength: 0,
    slabWidth: 0,
    slabThickness: 0,
    floorHeight: 0,
    slabType: "monolityczny",
    formworkSystem: "",
  };

  selectedPdfFiles = signal<File[]>([]);
  isUploading = signal(false);
  isDragging = signal(false);

  // Creation state
  isCreating = signal(false);
  creationStatus = signal("");
  creationProgress = signal(0);
  protected error = signal<string | null>(null);

  constructor() {
    // Hardcoded defaults as requested
    const hardcodedPath =
      "/home/dawid/Dokumenty/projektkonstrukcji/rzut poddasza 02.2025.pdf";
    this.project.sourcePdfPath = hardcodedPath;
    this.project.name = "Projekt Poddasza (Auto)";

    this.project.slabLength = 10;
    this.project.slabWidth = 10;
    this.project.slabThickness = 0.2;
    this.project.floorHeight = 3.0;

    const mockFile = new File([""], "rzut poddasza 02.2025.pdf", {
      type: "application/pdf",
    });
    this.selectedPdfFiles.set([mockFile]);
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

    if (!this.project.name) {
      this.project.name = file.name.replace(".pdf", "");
    }

    const tempId = "temp_" + Date.now();

    this.projectsService.uploadPdf(tempId, file).subscribe({
      next: (res: any) => {
        if (res.paths) {
          this.project.sourcePdfPath = res.paths.pdf;
          this.project.dxfPath = res.paths.dxf;
          this.project.geoJsonPath = res.paths.json;
        } else if (res.sourceFile) {
          this.project.sourcePdfPath = res.sourceFile;
        }
        this.isUploading.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error("Upload failed", err);
        this.isUploading.set(false);
        this.messageService.add({
          severity: "error",
          summary: "Błąd",
          detail: "Błąd przesyłania pliku",
        });
        this.cdr.detectChanges();
      },
    });
  }

  isValid(): boolean {
    return !!this.project.name && this.selectedPdfFiles().length > 0;
  }

  submit() {
    if (!this.isValid()) {
      if (!this.project.name) {
        this.error.set("Nazwa projektu jest wymagana");
      }
      return;
    }
    this.error.set(null);

    this.isCreating.set(true);
    this.creationStatus.set("Tworzenie projektu...");
    this.creationProgress.set(10);
    this.cdr.detectChanges();

    this.projectsService.create(this.project).subscribe({
      next: (project) => {
        this.creationProgress.set(40);

        if (this.project.sourcePdfPath) {
          this.creationStatus.set("Generowanie geometrii (Auto-Trace)...");
          this.cdr.detectChanges();

          this.projectsService
            .extractGeometry(this.project.sourcePdfPath, project.id)
            .subscribe({
              next: (job) => {
                console.log("DEBUG: Extraction job completed", job);
                this.creationProgress.set(100);
                this.creationStatus.set("Gotowe!");
                this.cdr.detectChanges();

                // Pass geometry data via router state to editor
                const geometryData = job.result || null;
                console.log("DEBUG: Passing geometry to editor", geometryData);

                setTimeout(() => {
                  // Close with project and geometry combined
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
                  summary: "Ostrzeżenie",
                  detail: "Błąd generowania geometrii",
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
        this.error.set("Błąd tworzenia projektu. Sprawdź połączenie.");
        this.messageService.add({
          severity: "error",
          summary: "Błąd",
          detail: "Błąd zapisu",
        });
        this.cdr.detectChanges();
      },
    });
  }
}
