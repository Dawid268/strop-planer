/**
 * DTO dla szalunków i optymalizacji
 */

export interface FormworkLayoutDto {
  readonly id: string;
  readonly projectName: string;
  readonly system: FormworkSystemType;
  readonly slabArea: number;
  readonly floorHeight: number;
  readonly elements: ReadonlyArray<FormworkElementDto>;
  readonly totalWeight: number;
  readonly estimatedCost: number | null;
  readonly estimatedAssemblyTime: number | null;
}

export interface FormworkElementDto {
  readonly elementType: FormworkElementType;
  readonly name: string;
  readonly quantity: number;
  readonly positionX: number | null;
  readonly positionY: number | null;
  readonly details: FormworkElementDetailsDto;
}

export interface FormworkElementDetailsDto {
  readonly length?: number;
  readonly width?: number;
  readonly height?: number;
  readonly area?: number;
  readonly loadCapacity?: number;
  readonly weight?: number;
  readonly dailyRentCost?: number;
}

export interface FormworkCalculationParamsDto {
  readonly slabArea: number;
  readonly slabThickness: number;
  readonly floorHeight: number;
  readonly preferredSystem?: FormworkSystemType;
  readonly maxBudget?: number;
  readonly includeBeams: boolean;
  readonly additionalLoad?: number;
}

export interface CalculateFormworkRequestDto {
  readonly slabData: SlabDataForCalculationDto;
  readonly params: FormworkCalculationParamsDto;
}

export interface SlabDataForCalculationDto {
  readonly id: string;
  readonly dimensions: {
    readonly length: number;
    readonly width: number;
    readonly thickness: number;
    readonly area: number;
  };
  readonly type: string;
  readonly beams: ReadonlyArray<unknown>;
  readonly reinforcement: ReadonlyArray<unknown>;
  readonly axes: {
    readonly horizontal: ReadonlyArray<string>;
    readonly vertical: ReadonlyArray<string>;
  };
}

export interface OptimizationResultDto {
  readonly originalLayout: FormworkLayoutDto;
  readonly optimizedLayout: FormworkLayoutDto;
  readonly areaSavings: number;
  readonly costSavings: number;
  readonly elementReduction: number;
  readonly recommendations: ReadonlyArray<string>;
  readonly alternatives: ReadonlyArray<FormworkLayoutDto>;
}

export interface FormworkSystemDto {
  readonly id: FormworkSystemType;
  readonly name: string;
  readonly manufacturer: string;
  readonly description: string;
}

export type FormworkSystemType =
  | "PERI_SKYDECK"
  | "DOKA_DOKAFLEX"
  | "ULMA_ENKOFLEX"
  | "MEVA"
  | "CUSTOM";

export type FormworkElementType =
  | "panel"
  | "prop"
  | "beam"
  | "head"
  | "tripod"
  | "drophead";

export const FORMWORK_SYSTEMS: readonly FormworkSystemType[] = [
  "PERI_SKYDECK",
  "DOKA_DOKAFLEX",
  "ULMA_ENKOFLEX",
  "MEVA",
  "CUSTOM",
] as const;
