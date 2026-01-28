import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../../environments/environment";

export interface SlabDataDto {
  id: string;
  dimensions: {
    length: number;
    width: number;
    thickness: number;
    area: number;
  };
  points?: Array<{ x: number; y: number }>;
  type: "monolityczny" | "teriva" | "filigran" | "zerowiec" | "inny";
  beams: any[];
  reinforcement: any[];
  axes: { horizontal: string[]; vertical: string[] };
}

export interface CalculateFormworkDto {
  slabArea: number;
  slabThickness: number;
  floorHeight: number;
  maxBudget?: number;
  includeBeams: boolean;
  preferredSystem?: string;
  additionalLoad?: number;
  optimizeForWarehouse?: boolean;
}

export interface CalculateRequestDto {
  slabData: SlabDataDto;
  params: CalculateFormworkDto;
}

@Injectable({ providedIn: "root" })
export class FormworkApiService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/formwork`;

  public calculate(dto: CalculateRequestDto): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/calculate`, dto);
  }
}
