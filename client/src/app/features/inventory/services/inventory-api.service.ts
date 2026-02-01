import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import type {
  InventoryItem,
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  InventorySummary,
} from "../models/inventory.model";
import { environment } from "../../../../environments/environment";
import { ApiResponse } from "@core/models/api-response.model";

@Injectable({ providedIn: "root" })
export class InventoryApiService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/inventory`;

  public getAll(filters?: {
    type?: string;
    system?: string;
    manufacturer?: string;
  }): Observable<InventoryItem[]> {
    const params: Record<string, string> = {};
    if (filters?.type) params["type"] = filters.type;
    if (filters?.system) params["system"] = filters.system;
    if (filters?.manufacturer) params["manufacturer"] = filters.manufacturer;

    return this.http
      .get<ApiResponse<InventoryItem[]>>(this.API_URL, { params })
      .pipe(map((res) => res.data));
  }

  public getById(id: string): Observable<InventoryItem> {
    return this.http
      .get<ApiResponse<InventoryItem>>(`${this.API_URL}/${id}`)
      .pipe(map((res) => res.data));
  }

  public getSummary(): Observable<InventorySummary> {
    return this.http
      .get<ApiResponse<InventorySummary>>(`${this.API_URL}/summary`)
      .pipe(map((res) => res.data));
  }

  public create(dto: CreateInventoryItemDto): Observable<InventoryItem> {
    return this.http
      .post<ApiResponse<InventoryItem>>(this.API_URL, dto)
      .pipe(map((res) => res.data));
  }

  public update(
    id: string,
    dto: UpdateInventoryItemDto,
  ): Observable<InventoryItem> {
    return this.http
      .put<ApiResponse<InventoryItem>>(`${this.API_URL}/${id}`, dto)
      .pipe(map((res) => res.data));
  }

  public delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }

  public reserve(id: string, quantity: number): Observable<InventoryItem> {
    return this.http
      .post<ApiResponse<InventoryItem>>(`${this.API_URL}/${id}/reserve`, {
        quantity,
      })
      .pipe(map((res) => res.data));
  }

  public release(id: string, quantity: number): Observable<InventoryItem> {
    return this.http
      .post<ApiResponse<InventoryItem>>(`${this.API_URL}/${id}/release`, {
        quantity,
      })
      .pipe(map((res) => res.data));
  }
}
