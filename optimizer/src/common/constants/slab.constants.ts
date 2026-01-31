/**
 * Slab and PDF extraction constants
 */

// ============================================================================
// Default Slab Values
// ============================================================================

export const SLAB_DEFAULTS = {
  ID: 'STROP_1',
  LENGTH: 12.0, // m
  WIDTH: 10.0, // m
  THICKNESS: 20, // cm
  AREA: 120.0, // m²
} as const;

// ============================================================================
// Concrete Classes
// ============================================================================

export const CONCRETE_CLASSES = {
  C20_25: 'C20/25',
  C25_30: 'C25/30',
  C30_37: 'C30/37',
  C35_45: 'C35/45',
  DEFAULT: 'C25/30',
} as const;

// ============================================================================
// Steel Classes
// ============================================================================

export const STEEL_CLASSES = {
  AIIIN: 'AIIIN(RB500W)',
  B500SP: 'B500SP',
  DEFAULT: 'AIIIN(RB500W)',
} as const;

// ============================================================================
// Reinforcement
// ============================================================================

export const REINFORCEMENT_DEFAULTS = {
  STIRRUP_DIAMETER: 6, // mm
  MAIN_BAR_DIAMETER: 12, // mm
} as const;

// ============================================================================
// Project Status
// ============================================================================

export const PROJECT_STATUS = {
  DRAFT: 'draft',
  CALCULATED: 'calculated',
  OPTIMIZED: 'optimized',
  COMPLETED: 'completed',
} as const;

export type ProjectStatusType =
  (typeof PROJECT_STATUS)[keyof typeof PROJECT_STATUS];

// ============================================================================
// Inventory Condition
// ============================================================================

export const INVENTORY_CONDITION = {
  NEW: 'nowy',
  GOOD: 'dobry',
  NEEDS_REPAIR: 'do_naprawy',
  DAMAGED: 'uszkodzony',
} as const;

export const INVENTORY_DEPRECIATION_DAYS = 365;
