/**
 * Formwork Models
 * Mirrors backend interfaces from optimizer/src/formwork/interfaces/formwork.interface.ts
 */

/** Available formwork system types */
export type FormworkSystemType =
  | 'PERI_SKYDECK'
  | 'DOKA_DOKAFLEX'
  | 'ULMA_ENKOFLEX'
  | 'MEVA'
  | 'CUSTOM';

/** Slab type options */
export type SlabType =
  | 'monolityczny'
  | 'teriva'
  | 'filigran'
  | 'zerowiec'
  | 'inny';

/** Formwork panel details */
export interface FormworkPanelDetails {
  /** Panel identifier */
  id: string;
  /** System type */
  system: FormworkSystemType;
  /** Length in cm */
  length: number;
  /** Width in cm */
  width: number;
  /** Area in m² */
  area: number;
  /** Load capacity in kN/m² */
  loadCapacity: number;
  /** Weight in kg */
  weight: number;
  /** Daily rental cost in PLN */
  dailyRentCost?: number;
}

/** Formwork prop (support) details */
export interface FormworkPropDetails {
  /** Prop type */
  type: 'eurostempel' | 'propsek' | 'wiezowiec';
  /** Minimum height in cm */
  minHeight: number;
  /** Maximum height in cm */
  maxHeight: number;
  /** Load capacity in kN */
  loadCapacity: number;
  /** Weight in kg */
  weight: number;
}

/** Formwork beam details */
export interface FormworkBeamDetails {
  /** Beam type */
  type: 'H20' | 'aluminium' | 'GT24';
  /** Length in cm */
  length: number;
  /** Support spacing in cm */
  supportSpacing: number;
  /** Bending capacity in kNm */
  bendingCapacity: number;
}

/** Generic formwork element */
export interface FormworkElement {
  /** Element type (canonical field) */
  elementType: 'panel' | 'prop' | 'beam' | 'head' | 'tripod' | 'drophead';
  /** Alternative type field (backward compatibility) */
  type?: 'panel' | 'prop' | 'beam' | 'head' | 'tripod' | 'drophead';
  /** Element name */
  name: string;
  /** Required quantity */
  quantity: number;
  /** X position on drawing in meters */
  positionX?: number;
  /** Y position on drawing in meters */
  positionY?: number;
  /** Rotation in degrees */
  rotation?: number;
  /** Type-specific details */
  details:
    | FormworkPanelDetails
    | FormworkPropDetails
    | FormworkBeamDetails
    | Record<string, unknown>;
}

/** Type guard to check if details is panel details */
export function isPanelDetails(
  details: FormworkElement['details'],
): details is FormworkPanelDetails {
  return (
    typeof details === 'object' &&
    details !== null &&
    'length' in details &&
    'width' in details &&
    'area' in details
  );
}

/** Complete formwork layout */
export interface FormworkLayout {
  /** Layout identifier */
  id: string;
  /** Project name */
  projectName: string;
  /** Formwork system */
  system: FormworkSystemType;
  /** Slab area in m² */
  slabArea: number;
  /** Floor height in cm */
  floorHeight: number;
  /** List of formwork elements */
  elements: FormworkElement[];
  /** Total formwork weight in kg */
  totalWeight: number;
  /** Estimated cost in PLN */
  estimatedCost?: number;
  /** Estimated assembly time in man-hours */
  estimatedAssemblyTime?: number;
}

/** Optimization result */
export interface OptimizationResult {
  /** Original layout */
  originalLayout: FormworkLayout;
  /** Optimized layout */
  optimizedLayout: FormworkLayout;
  /** Area savings percentage */
  areaSavings: number;
  /** Cost savings percentage */
  costSavings: number;
  /** Element count reduction */
  elementReduction: number;
  /** Recommendations */
  recommendations: string[];
  /** Alternative solutions */
  alternatives: FormworkLayout[];
}

/** Beam section dimensions */
export interface BeamSection {
  width: number;
  height: number;
}

/** Beam data from structural analysis */
export interface BeamData {
  /** Beam symbol/identifier */
  symbol: string;
  /** Quantity */
  quantity: number;
  /** Main rebar diameter in mm */
  mainRebarDiameter: number;
  /** Stirrup diameter in mm */
  stirrupDiameter: number;
  /** Total length in m */
  totalLength: number;
  /** Span in m */
  span?: number;
  /** Cross-section dimensions */
  section?: BeamSection;
}

/** Reinforcement element types */
export type ReinforcementElementType =
  | 'main_bottom'
  | 'main_top'
  | 'stirrup'
  | 'distribution';

/** Reinforcement data */
export interface ReinforcementData {
  /** Element identifier */
  elementId: string;
  /** Element type */
  elementType: ReinforcementElementType | string;
  /** Diameter in mm */
  diameter: number;
  /** Length in m */
  length: number;
  /** Quantity */
  quantity: number;
  /** Total mass in kg */
  totalMass?: number;
}

/** Slab dimensions */
export interface SlabDimensions {
  /** Length in m */
  length: number;
  /** Width in m */
  width: number;
  /** Thickness in cm */
  thickness: number;
  /** Area in m² */
  area: number;
}

/** Axes data for structural drawings */
export interface AxesData {
  horizontal: string[];
  vertical: string[];
}

/** Complete slab data */
export interface SlabDataDto {
  /** Slab identifier */
  id: string;
  /** Dimensions */
  dimensions: SlabDimensions;
  /** Polygon points for slab outline */
  points?: Array<{ x: number; y: number }>;
  /** Slab type */
  type: SlabType;
  /** Beam data */
  beams: BeamData[];
  /** Reinforcement data */
  reinforcement: ReinforcementData[];
  /** Structural axes */
  axes: AxesData;
}

/** Formwork calculation parameters */
export interface CalculateFormworkDto {
  /** Slab area in m² */
  slabArea: number;
  /** Slab thickness in cm */
  slabThickness: number;
  /** Floor height in cm */
  floorHeight: number;
  /** Maximum budget in PLN */
  maxBudget?: number;
  /** Whether to include beams */
  includeBeams: boolean;
  /** Preferred formwork system */
  preferredSystem?: FormworkSystemType;
  /** Additional load in kN/m² */
  additionalLoad?: number;
  /** Optimize for warehouse inventory */
  optimizeForWarehouse?: boolean;
}

/** Request DTO for formwork calculation */
export interface CalculateRequestDto {
  slabData: SlabDataDto;
  params: CalculateFormworkDto;
}
