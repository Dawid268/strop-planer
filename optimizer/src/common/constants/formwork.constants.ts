/**
 * Formwork calculation constants
 * All values used in formwork calculations and optimizations
 */

// ============================================================================
// Formwork Systems
// ============================================================================

export const FORMWORK_SYSTEMS = {
  PERI_SKYDECK: 'PERI_SKYDECK',
  DOKA_DOKAFLEX: 'DOKA_DOKAFLEX',
  ULMA_ENKOFLEX: 'ULMA_ENKOFLEX',
  MEVA: 'MEVA',
  CUSTOM: 'CUSTOM',
} as const;

export type FormworkSystemType = keyof typeof FORMWORK_SYSTEMS;

export const FORMWORK_SYSTEMS_LIST = Object.values(FORMWORK_SYSTEMS);

export const ALTERNATIVE_SYSTEMS = [
  FORMWORK_SYSTEMS.DOKA_DOKAFLEX,
  FORMWORK_SYSTEMS.ULMA_ENKOFLEX,
] as const;

// ============================================================================
// Props (Podpory)
// ============================================================================

export const PROP_CONFIG = {
  TYPE: 'eurostempel',
  MIN_HEIGHT: 200, // cm
  DEFAULT_SPACING: 1.2, // m
  TRIPOD_PROPS_COUNT: 4,
  TRIPOD_WEIGHT: 5, // kg
} as const;

// ============================================================================
// Beams (Dźwigary)
// ============================================================================

export const BEAM_CONFIG = {
  TYPE: 'H20',
  SUPPORT_SPACING: 150, // cm
  BENDING_CAPACITY: 6.0, // kNm
  WEIGHT_PER_METER: 3.5, // kg/m
  PRIMARY_SPACING: 0.5, // m
  SECONDARY_SPACING: 0.75, // m
} as const;

// ============================================================================
// Auxiliary Elements
// ============================================================================

export const AUXILIARY_CONFIG = {
  DROPHEAD_WEIGHT: 2.5, // kg
  HEAD_WEIGHT: 1.8, // kg
} as const;

// ============================================================================
// Cost & Time Calculation
// ============================================================================

export const COST_CONFIG = {
  DEFAULT_RENTAL_DAYS: 30,
  DEFAULT_DAILY_RENT_COST: 2, // PLN/day
  LABOR_HOURS_PER_SQM: 0.3, // roboczogodziny/m²
  LABOR_HOURS_PER_ELEMENT: 0.05,
} as const;

// ============================================================================
// Optimization Thresholds
// ============================================================================

export const OPTIMIZATION_THRESHOLDS = {
  SMALL_PANEL_COUNT: 10,
  HIGH_PROP_DENSITY: 1.2, // props per m²
} as const;

// ============================================================================
// DXF/Drawing
// ============================================================================

export const DXF_CONFIG = {
  DEFAULT_LAYER: 'default',
  DEFAULT_BOUNDS: {
    MIN_X: 0,
    MIN_Y: 0,
    MAX_X: 100,
    MAX_Y: 100,
  },
} as const;

// ============================================================================
// Geometry Extraction
// ============================================================================

export const GEOMETRY_CONFIG = {
  DEFAULT_TAB_NAME: 'Strona 1',
  AI_LAYER_NAME: 'Wektory (AI)',
  AI_LAYER_COLOR: '#9c27b0',
  USER_LAYER_NAME: 'Warstwa użytkownika',
  USER_LAYER_COLOR: '#2196f3',
} as const;
