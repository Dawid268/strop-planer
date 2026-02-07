import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEventType, HttpEvent } from '@angular/common/http';
import { Observable, map, filter } from 'rxjs';

import { environment } from '@env/environment';

import type { FloorPlanDocument, DxfData } from '@models/floor-plan.model';
import { ApiResponse } from '@models/api-response.model';

/**
 * Pure HTTP service for Floor Plan DXF API calls.
 * State management is handled by FloorPlanStore.
 */
@Injectable({ providedIn: 'root' })
export class FloorPlanApiService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/floor-plans-dxf`;

  /**
   * Upload PDF or DXF file and get parsed data
   * @param file - File to upload (PDF or DXF)
   * @returns Observable with upload progress and final result
   */
  public upload(file: File): Observable<{
    type: 'progress' | 'complete';
    progress?: number;
    data?: FloorPlanDocument;
  }> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post<ApiResponse<FloorPlanDocument>>(
        `${this.API_URL}/upload`,
        formData,
        {
          reportProgress: true,
          observe: 'events',
        },
      )
      .pipe(
        map((event: HttpEvent<ApiResponse<FloorPlanDocument>>) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            return {
              type: 'progress' as const,
              progress: Math.round((100 * event.loaded) / event.total),
            };
          } else if (event.type === HttpEventType.Response && event.body) {
            return {
              type: 'complete' as const,
              data: event.body.data,
            };
          }
          return { type: 'progress' as const, progress: 0 };
        }),
        filter(
          (result) => result.type === 'progress' || result.data !== undefined,
        ),
      );
  }

  /**
   * Upload file without progress tracking (simple version)
   */
  public uploadSimple(file: File): Observable<FloorPlanDocument> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post<ApiResponse<FloorPlanDocument>>(`${this.API_URL}/upload`, formData)
      .pipe(map((res) => res.data));
  }

  /**
   * Get parsed floor plan data by document ID
   */
  public getById(documentId: string): Observable<DxfData> {
    return this.http
      .get<ApiResponse<DxfData>>(`${this.API_URL}/${documentId}`)
      .pipe(map((res) => res.data));
  }

  /**
   * Get raw DXF content by document ID
   */
  public getRawDxf(documentId: string): Observable<Blob> {
    return this.http.get(`${this.API_URL}/${documentId}/raw`, {
      responseType: 'blob',
    });
  }
}
