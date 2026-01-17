import { Injectable, inject } from "@angular/core";
import {
  HttpClient,
  HttpEvent,
  HttpEventType,
  HttpRequest,
  HttpResponse,
} from "@angular/common/http";
import { Observable, map, filter } from "rxjs";
import { environment } from "../../../../environments/environment";

export interface ExtractedPdfData {
  sourceFile: string;
  extractedAt: Date;
  slab?: {
    dimensions: {
      length: number;
      width: number;
      thickness: number;
      area: number;
    };
    type: string;
    beams: unknown[];
    reinforcement: unknown[];
  } | null;
  rawText: string;
  warnings: string[];
  geometry?: { polygons: { x: number; y: number }[][] };
}

export type DrawingType =
  | "slab"
  | "structure"
  | "reinforcement"
  | "architecture"
  | "roof"
  | "foundation"
  | "other";

export interface RecognizedFile {
  fileName: string;
  drawingType: DrawingType;
  confidence: number;
  isRecommended: boolean;
  extractedData: ExtractedPdfData | null;
}

export interface BatchUploadResult {
  files: RecognizedFile[];
  recommendedFiles: string[];
  totalFiles: number;
  successfullyParsed: number;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
}

export type UploadResponse =
  | { type: "progress"; progress: UploadProgress }
  | { type: "complete"; data: ExtractedPdfData };

@Injectable({
  providedIn: "root",
})
export class PdfApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  /**
   * Uploads single PDF file
   */
  public uploadPdfSimple(file: File): Observable<ExtractedPdfData> {
    const formData = new FormData();
    formData.append("file", file);
    return this.http.post<ExtractedPdfData>(
      `${this.apiUrl}/pdf/upload`,
      formData
    );
  }

  /**
   * Uploads multiple PDF files - returns recognized file types
   */
  public uploadBatch(files: File[]): Observable<BatchUploadResult> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });
    return this.http.post<BatchUploadResult>(
      `${this.apiUrl}/pdf/upload-batch`,
      formData
    );
  }

  /**
   * Uploads PDF file with progress tracking
   */
  public uploadPdf(file: File): Observable<UploadResponse> {
    const formData = new FormData();
    formData.append("file", file);

    const request = new HttpRequest(
      "POST",
      `${this.apiUrl}/pdf/upload`,
      formData,
      { reportProgress: true }
    );

    return this.http.request<ExtractedPdfData>(request).pipe(
      filter(
        (event: HttpEvent<ExtractedPdfData>) =>
          event.type === HttpEventType.UploadProgress ||
          event.type === HttpEventType.Response
      ),
      map((event: HttpEvent<ExtractedPdfData>): UploadResponse => {
        if (event.type === HttpEventType.UploadProgress) {
          const total = event.total || 1;
          const loaded = event.loaded;
          return {
            type: "progress",
            progress: {
              loaded,
              total,
              percent: Math.round((loaded / total) * 100),
            },
          };
        }
        const response = event as HttpResponse<ExtractedPdfData>;
        return {
          type: "complete",
          data: response.body as ExtractedPdfData,
        };
      })
    );
  }

  /**
   * Returns Polish label for drawing type
   */
  public getDrawingTypeLabel(type: DrawingType): string {
    const labels: Record<DrawingType, string> = {
      slab: "Strop",
      structure: "Konstrukcja",
      reinforcement: "Zbrojenie",
      architecture: "Architektura",
      roof: "Więźba",
      foundation: "Fundamenty",
      other: "Inne",
    };
    return labels[type] || type;
  }
}
