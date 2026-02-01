/**
 * DTO dla danych stropu i szalunków
 */

export interface SlabDataDto {
  readonly id: string;
  readonly dimensions: SlabDimensionsDto;
  readonly type: SlabType;
  readonly beams: ReadonlyArray<BeamDataDto>;
  readonly reinforcement: ReadonlyArray<ReinforcementDataDto>;
  readonly axes: SlabAxesDto;
  readonly concreteClass: string | null;
  readonly steelClass: string | null;
  readonly notes: ReadonlyArray<string>;
}

export interface SlabDimensionsDto {
  readonly length: number;
  readonly width: number;
  readonly thickness: number;
  readonly area: number;
}

export interface BeamDataDto {
  readonly symbol: string;
  readonly quantity: number;
  readonly mainRebarDiameter: number;
  readonly stirrupDiameter: number;
  readonly totalLength: number;
  readonly span: number | null;
  readonly section: BeamSectionDto | null;
}

export interface BeamSectionDto {
  readonly width: number;
  readonly height: number;
}

export interface ReinforcementDataDto {
  readonly elementId: string;
  readonly elementType: ReinforcementElementType;
  readonly diameter: number;
  readonly length: number;
  readonly quantity: number;
  readonly totalMass: number | null;
}

export interface SlabAxesDto {
  readonly horizontal: ReadonlyArray<string>;
  readonly vertical: ReadonlyArray<string>;
}

export interface ExtractedPdfDataDto {
  readonly sourceFile: string;
  readonly extractedAt: string;
  readonly slab: SlabDataDto | null;
  readonly rawText: string;
  readonly warnings: ReadonlyArray<string>;
}

export type SlabType =
  | 'monolityczny'
  | 'teriva'
  | 'filigran'
  | 'zerowiec'
  | 'inny';

export type ReinforcementElementType =
  | 'wieniec'
  | 'belka'
  | 'strop'
  | 'slup'
  | 'nadproze';

export const SLAB_TYPES: readonly SlabType[] = [
  'monolityczny',
  'teriva',
  'filigran',
  'zerowiec',
  'inny',
] as const;
