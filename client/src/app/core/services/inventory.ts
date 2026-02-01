import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import type {
  InventoryItemDto,
  InventorySummaryDto,
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  InventoryFilterDto,
} from '../../shared/dto';
import { environment } from '../../../environments/environment';

const API_BASE = `${environment.apiUrl}/inventory`;

@Injectable({
  providedIn: 'root',
})
export class InventoryService {
  private readonly http = inject(HttpClient);

  /**
   * Pobiera wszystkie elementy magazynowe z opcjonalnymi filtrami
   */
  public getAll(
    filter?: InventoryFilterDto,
  ): Observable<ReadonlyArray<InventoryItemDto>> {
    let params = new HttpParams();

    if (filter) {
      if (filter.type) {
        params = params.set('type', filter.type);
      }
      if (filter.system) {
        params = params.set('system', filter.system);
      }
      if (filter.manufacturer) {
        params = params.set('manufacturer', filter.manufacturer);
      }
      if (filter.condition) {
        params = params.set('condition', filter.condition);
      }
      if (filter.isActive !== undefined) {
        params = params.set('isActive', String(filter.isActive));
      }
      if (filter.minQuantity !== undefined) {
        params = params.set('minQuantity', String(filter.minQuantity));
      }
    }

    return this.http.get<ReadonlyArray<InventoryItemDto>>(API_BASE, { params });
  }

  /**
   * Pobiera pojedynczy element po ID
   */
  public getById(id: string): Observable<InventoryItemDto> {
    return this.http.get<InventoryItemDto>(`${API_BASE}/${id}`);
  }

  /**
   * Pobiera podsumowanie stanu magazynowego
   */
  public getSummary(): Observable<InventorySummaryDto> {
    return this.http.get<InventorySummaryDto>(`${API_BASE}/summary`);
  }

  /**
   * Tworzy nowy element magazynowy
   */
  public create(dto: CreateInventoryItemDto): Observable<InventoryItemDto> {
    return this.http.post<InventoryItemDto>(API_BASE, dto);
  }

  /**
   * Aktualizuje element magazynowy
   */
  public update(
    id: string,
    dto: UpdateInventoryItemDto,
  ): Observable<InventoryItemDto> {
    return this.http.put<InventoryItemDto>(`${API_BASE}/${id}`, dto);
  }

  /**
   * Usuwa element magazynowy
   */
  public delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${API_BASE}/${id}`);
  }

  /**
   * Rezerwuje określoną ilość elementów
   */
  public reserve(id: string, quantity: number): Observable<InventoryItemDto> {
    return this.http.post<InventoryItemDto>(`${API_BASE}/${id}/reserve`, {
      quantity,
    });
  }

  /**
   * Zwalnia rezerwację
   */
  public release(id: string, quantity: number): Observable<InventoryItemDto> {
    return this.http.post<InventoryItemDto>(`${API_BASE}/${id}/release`, {
      quantity,
    });
  }
}
