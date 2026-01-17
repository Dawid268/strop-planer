/**
 * Interfejsy dla wirtualnego magazynu szalunków
 */

export interface InventoryItem {
  /** Unikalny identyfikator */
  id: string;
  /** Kod katalogowy producenta */
  catalogCode: string;
  /** Nazwa elementu */
  name: string;
  /** Typ elementu */
  type:
    | 'panel'
    | 'prop'
    | 'beam'
    | 'head'
    | 'tripod'
    | 'drophead'
    | 'accessory';
  /** System szalunkowy */
  system: string;
  /** Producent */
  manufacturer: string;
  /** Wymiary [cm] */
  dimensions: {
    length?: number;
    width?: number;
    height?: number;
  };
  /** Dostępna ilość */
  quantityAvailable: number;
  /** Ilość zarezerwowana */
  quantityReserved: number;
  /** Nośność [kN lub kN/m²] */
  loadCapacity?: number;
  /** Waga sztuki [kg] */
  weight: number;
  /** Cena wynajmu dziennego [PLN] */
  dailyRentPrice: number;
  /** Stan techniczny */
  condition: 'nowy' | 'dobry' | 'używany' | 'do_naprawy';
  /** Lokalizacja w magazynie */
  warehouseLocation?: string;
  /** Aktywny (dostępny do wynajmu) */
  isActive: boolean;
  /** Data ostatniego przeglądu */
  lastInspectionDate?: Date;
  /** Uwagi */
  notes?: string;
}

export interface WarehouseOwner {
  id: string;
  companyName: string;
  email: string;
  phone?: string;
  address?: string;
  taxId?: string;
}

export interface InventorySummary {
  totalItems: number;
  totalValue: number;
  byType: Record<string, number>;
  bySystem: Record<string, number>;
  availableForRent: number;
  reserved: number;
  underRepair: number;
}

export interface CreateInventoryItemDto {
  catalogCode: string;
  name: string;
  type: InventoryItem['type'];
  system: string;
  manufacturer: string;
  dimensions?: InventoryItem['dimensions'];
  quantityAvailable: number;
  loadCapacity?: number;
  weight: number;
  dailyRentPrice: number;
  condition?: InventoryItem['condition'];
  warehouseLocation?: string;
  notes?: string;
}

export interface UpdateInventoryItemDto extends Partial<CreateInventoryItemDto> {
  quantityReserved?: number;
  isActive?: boolean;
  lastInspectionDate?: Date;
}

export interface InventoryFilter {
  type?: InventoryItem['type'];
  system?: string;
  manufacturer?: string;
  minQuantity?: number;
  condition?: InventoryItem['condition'];
  isActive?: boolean;
}
