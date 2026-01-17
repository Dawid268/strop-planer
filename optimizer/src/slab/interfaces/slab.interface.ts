/**
 * Interfejsy dla danych stropu wyekstrahowanych z PDF
 */

export interface SlabDimensions {
  /** Długość stropu w metrach */
  length: number;
  /** Szerokość stropu w metrach */
  width: number;
  /** Grubość stropu w centymetrach */
  thickness: number;
  /** Powierzchnia w m² */
  area: number;
}

export interface BeamData {
  /** Symbol belki (np. B1, B2) */
  symbol: string;
  /** Liczba belek danego typu */
  quantity: number;
  /** Średnica zbrojenia głównego [mm] */
  mainRebarDiameter: number;
  /** Średnica strzemion [mm] */
  stirrupDiameter: number;
  /** Długość całkowita prętów [m] */
  totalLength: number;
  /** Rozpiętość belki [m] */
  span?: number;
  /** Przekrój belki [cm x cm] */
  section?: { width: number; height: number };
}

export interface ReinforcementData {
  /** Oznaczenie elementu (W1, B1, S1, etc.) */
  elementId: string;
  /** Typ elementu */
  elementType: 'wieniec' | 'belka' | 'strop' | 'slup' | 'nadproze';
  /** Średnica pręta [mm] */
  diameter: number;
  /** Długość pojedynczego pręta [m] */
  length: number;
  /** Ilość prętów */
  quantity: number;
  /** Masa całkowita [kg] */
  totalMass?: number;
}

export interface SlabData {
  /** Nazwa/identyfikator stropu */
  id: string;
  /** Wymiary stropu */
  dimensions: SlabDimensions;
  /** Typ stropu (monolityczny, prefabrykowany, Teriva, etc.) */
  type: 'monolityczny' | 'teriva' | 'filigran' | 'zerowiec' | 'inny';
  /** Lista belek stropowych */
  beams: BeamData[];
  /** Dane zbrojeniowe */
  reinforcement: ReinforcementData[];
  /** Osie konstrukcyjne */
  axes: {
    horizontal: string[];
    vertical: string[];
  };
  /** Klasa betonu */
  concreteClass?: string;
  /** Klasa stali zbrojeniowej */
  steelClass?: string;
  /** Dodatkowe uwagi z projektu */
  notes?: string[];
}

export interface ExtractedPdfData {
  /** Nazwa pliku źródłowego */
  sourceFile: string;
  /** Data ekstrakcji */
  extractedAt: Date;
  /** Wyekstrahowane dane stropu */
  slab: SlabData | null | undefined;
  /** Surowy tekst z PDF */
  rawText: string;
  /** Ostrzeżenia podczas parsowania */
  warnings: string[];
  /** Wykryte kształty geometryczne (Polygons) */
  geometry?: { polygons: { x: number; y: number }[][] };
}
