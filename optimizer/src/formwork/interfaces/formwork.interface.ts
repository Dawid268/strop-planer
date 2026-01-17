/**
 * Interfejsy dla systemu szalunków stropowych
 * Oparte na popularnych systemach: PERI, DOKA, ULMA, MEVA
 */

export type FormworkSystemType =
  | 'PERI_SKYDECK'
  | 'DOKA_DOKAFLEX'
  | 'ULMA_ENKOFLEX'
  | 'MEVA'
  | 'CUSTOM';

export interface FormworkPanel {
  /** Identyfikator panelu */
  id: string;
  /** Typ systemu */
  system: FormworkSystemType;
  /** Długość panelu [cm] */
  length: number;
  /** Szerokość panelu [cm] */
  width: number;
  /** Powierzchnia [m²] */
  area: number;
  /** Nośność [kN/m²] */
  loadCapacity: number;
  /** Waga panelu [kg] */
  weight: number;
  /** Koszt wynajmu dziennego [PLN] */
  dailyRentCost?: number;
}

export interface FormworkProp {
  /** Typ stojaka */
  type: 'eurostempel' | 'propsek' | 'wiezowiec';
  /** Wysokość minimalna [cm] */
  minHeight: number;
  /** Wysokość maksymalna [cm] */
  maxHeight: number;
  /** Nośność [kN] */
  loadCapacity: number;
  /** Waga [kg] */
  weight: number;
}

export interface FormworkBeam {
  /** Typ dźwigara (drewniany H20, aluminiowy) */
  type: 'H20' | 'aluminium' | 'GT24';
  /** Długość [cm] */
  length: number;
  /** Rozstaw podpór [cm] */
  supportSpacing: number;
  /** Nośność na zginanie [kNm] */
  bendingCapacity: number;
}

export interface FormworkElement {
  /** Typ elementu */
  elementType: 'panel' | 'prop' | 'beam' | 'head' | 'tripod' | 'drophead';
  /** Nazwa elementu */
  name: string;
  /** Ilość wymagana */
  quantity: number;
  /** Pozycja X na rysunku [m] */
  positionX?: number;
  /** Pozycja Y na rysunku [m] */
  positionY?: number;
  /** Szczegóły specyficzne dla typu */
  details:
    | FormworkPanel
    | FormworkProp
    | FormworkBeam
    | Record<string, unknown>;
}

export interface FormworkLayout {
  /** Identyfikator layoutu */
  id: string;
  /** Nazwa projektu */
  projectName: string;
  /** System szalunkowy */
  system: FormworkSystemType;
  /** Powierzchnia stropu [m²] */
  slabArea: number;
  /** Wysokość kondygnacji [cm] */
  floorHeight: number;
  /** Lista elementów szalunkowych */
  elements: FormworkElement[];
  /** Całkowita waga szalunku [kg] */
  totalWeight: number;
  /** Szacowany koszt [PLN] */
  estimatedCost?: number;
  /** Czas montażu [roboczogodziny] */
  estimatedAssemblyTime?: number;
}

export interface OptimizationResult {
  /** Oryginalny layout */
  originalLayout: FormworkLayout;
  /** Zoptymalizowany layout */
  optimizedLayout: FormworkLayout;
  /** Procent oszczędności powierzchni */
  areaSavings: number;
  /** Procent oszczędności kosztów */
  costSavings: number;
  /** Redukcja liczby elementów */
  elementReduction: number;
  /** Rekomendacje */
  recommendations: string[];
  /** Alternatywne rozwiązania */
  alternatives: FormworkLayout[];
}

export interface FormworkCalculationParams {
  /** Dane stropu */
  slabArea: number;
  slabThickness: number;
  /** Wysokość kondygnacji [cm] */
  floorHeight: number;
  /** Preferowany system */
  preferredSystem?: FormworkSystemType;
  /** Maksymalny budżet [PLN] */
  maxBudget?: number;
  /** Czy uwzględnić belki */
  includeBeams: boolean;
  /** Dodatkowe obciążenie użytkowe [kN/m²] */
  additionalLoad?: number;
}
