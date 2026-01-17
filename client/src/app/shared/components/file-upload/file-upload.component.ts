import {
  Component,
  ChangeDetectionStrategy,
  output,
  signal,
  input,
  inject,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { ButtonModule } from "primeng/button";
import { ProgressBarModule } from "primeng/progressbar";
import { MessageModule } from "primeng/message";
import { TooltipModule } from "primeng/tooltip";
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";

export interface UploadedFile {
  file: File;
  name: string;
  size: number;
  type: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

@Component({
  selector: "app-file-upload",
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    ProgressBarModule,
    MessageModule,
    TooltipModule,
    TranslocoModule,
  ],
  templateUrl: "./file-upload.component.html",
  styleUrl: "./file-upload.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileUploadComponent {
  private readonly transloco = inject(TranslocoService);

  // Inputs
  public readonly multiple = input<boolean>(true);
  public readonly maxFiles = input<number>(20);

  // Outputs
  public readonly filesSelected = output<UploadedFile[]>();
  public readonly uploadError = output<string>();

  // State
  protected readonly isDragOver = signal<boolean>(false);
  protected readonly selectedFiles = signal<UploadedFile[]>([]);
  protected readonly uploadProgress = signal<UploadProgress | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  // Accepted file types
  protected readonly acceptedTypes = ".pdf,.dwg,.dxf";

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragOver.set(false);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleFiles(Array.from(files));
    }
  }

  protected onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFiles(Array.from(input.files));
    }
  }

  protected clearFiles(): void {
    this.selectedFiles.set([]);
    this.errorMessage.set(null);
    this.uploadProgress.set(null);
  }

  protected removeFile(index: number): void {
    const files = [...this.selectedFiles()];
    files.splice(index, 1);
    this.selectedFiles.set(files);
    this.filesSelected.emit(files);
  }

  private handleFiles(files: File[]): void {
    this.errorMessage.set(null);

    const validFiles: UploadedFile[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const extension = file.name.split(".").pop()?.toLowerCase();
      const isValidExtension = ["pdf", "dwg", "dxf"].includes(extension || "");

      if (!isValidExtension) {
        errors.push(
          `${file.name}: ${this.transloco.translate(
            "fileUpload.errors.unsupportedFormat"
          )}`
        );
        continue;
      }

      // Max file size 50MB
      if (file.size > 50 * 1024 * 1024) {
        errors.push(
          `${file.name}: ${this.transloco.translate(
            "fileUpload.errors.fileTooLarge"
          )}`
        );
        continue;
      }

      validFiles.push({
        file,
        name: file.name,
        size: file.size,
        type: extension || "unknown",
      });
    }

    // Check max files
    const max = this.maxFiles();
    if (validFiles.length > max) {
      errors.push(
        this.transloco.translate("fileUpload.errors.maxFiles", { max })
      );
      validFiles.splice(max);
    }

    if (errors.length > 0) {
      this.errorMessage.set(errors.join(". "));
      this.uploadError.emit(errors.join(". "));
    }

    if (validFiles.length > 0) {
      if (this.multiple()) {
        const current = this.selectedFiles();
        const combined = [...current, ...validFiles].slice(0, max);
        this.selectedFiles.set(combined);
        this.filesSelected.emit(combined);
      } else {
        this.selectedFiles.set([validFiles[0]]);
        this.filesSelected.emit([validFiles[0]]);
      }
    }
  }

  protected formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  protected getFileIcon(type: string): string {
    switch (type) {
      case "pdf":
        return "pi-file-pdf";
      case "dwg":
      case "dxf":
        return "pi-pencil";
      default:
        return "pi-file";
    }
  }
}
