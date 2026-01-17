import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import type {
  FormworkLayoutDto,
  FormworkSystemDto,
  CalculateFormworkRequestDto,
  OptimizationResultDto,
} from "../../shared/dto";
import { environment } from "../../../environments/environment";

const API_BASE = `${environment.apiUrl}/formwork`;

@Injectable({
  providedIn: "root",
})
export class FormworkService {
  private readonly http = inject(HttpClient);

  /**
   * Pobiera listę dostępnych systemów szalunkowych
   */
  public getSystems(): Observable<{
    systems: ReadonlyArray<FormworkSystemDto>;
  }> {
    return this.http.get<{ systems: ReadonlyArray<FormworkSystemDto> }>(
      `${API_BASE}/systems`
    );
  }

  /**
   * Oblicza układ szalunku dla stropu
   */
  public calculate(
    request: CalculateFormworkRequestDto
  ): Observable<FormworkLayoutDto> {
    return this.http.post<FormworkLayoutDto>(`${API_BASE}/calculate`, request);
  }

  /**
   * Optymalizuje istniejący układ szalunku
   */
  public optimize(layoutId: string): Observable<OptimizationResultDto> {
    return this.http.post<OptimizationResultDto>(
      `${API_BASE}/optimize/${layoutId}`,
      {}
    );
  }

  /**
   * Pobiera zapisany układ szalunku
   */
  public getLayout(layoutId: string): Observable<FormworkLayoutDto> {
    return this.http.get<FormworkLayoutDto>(`${API_BASE}/layout/${layoutId}`);
  }
}
