import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import type {
  InventoryItem,
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  InventorySummary,
} from "../models/inventory.model";
import { environment } from "../../../../environments/environment";

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
    return this.http.get<InventoryItem[]>(this.API_URL, { params });
  }

  public getById(id: string): Observable<InventoryItem> {
    return this.http.get<InventoryItem>(`${this.API_URL}/${id}`);
  }

  public getSummary(): Observable<InventorySummary> {
    return this.http.get<InventorySummary>(`${this.API_URL}/summary`);
  }

  public create(dto: CreateInventoryItemDto): Observable<InventoryItem> {
    return this.http.post<InventoryItem>(this.API_URL, dto);
  }

  public update(
    id: string,
    dto: UpdateInventoryItemDto
  ): Observable<InventoryItem> {
    return this.http.put<InventoryItem>(`${this.API_URL}/${id}`, dto);
  }

  public delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }

  public reserve(id: string, quantity: number): Observable<InventoryItem> {
    return this.http.post<InventoryItem>(`${this.API_URL}/${id}/reserve`, {
      quantity,
    });
  }

  public release(id: string, quantity: number): Observable<InventoryItem> {
    return this.http.post<InventoryItem>(`${this.API_URL}/${id}/release`, {
      quantity,
    });
  }
}
