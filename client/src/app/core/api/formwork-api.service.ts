import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '@env/environment';

import { ApiResponse } from '@models/api-response.model';
import type {
  SlabDataDto,
  CalculateFormworkDto,
  CalculateRequestDto,
  FormworkLayout,
} from '@models/formwork.models';

// Re-export for backward compatibility
export type { SlabDataDto, CalculateFormworkDto, CalculateRequestDto };

@Injectable({ providedIn: 'root' })
export class FormworkApiService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/formwork`;

  public calculate(dto: CalculateRequestDto): Observable<FormworkLayout> {
    return this.http
      .post<ApiResponse<FormworkLayout>>(`${this.API_URL}/calculate`, dto)
      .pipe(map((res) => res.data));
  }
}
