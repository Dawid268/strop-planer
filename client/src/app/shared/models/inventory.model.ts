export interface InventoryItemDimensions {
  length?: number;
  width?: number;
  height?: number;
}

export interface InventoryItem {
  id: string;
  catalogCode: string;
  name: string;
  type:
    | 'panel'
    | 'prop'
    | 'beam'
    | 'accessory'
    | 'head'
    | 'tripod'
    | 'drophead';
  system: string;
  manufacturer: string;
  dimensions: InventoryItemDimensions;
  quantityAvailable: number;
  quantityReserved: number;
  weight: number;
  dailyRentPrice: number;
  condition: 'nowy' | 'dobry' | 'używany' | 'do_naprawy';
  warehouseLocation?: string;
  isActive: boolean;
}

export interface CreateInventoryItemDto {
  catalogCode: string;
  name: string;
  type: InventoryItem['type'];
  system: string;
  manufacturer: string;
  dimensions: InventoryItemDimensions;
  quantityAvailable: number;
  weight: number;
  dailyRentPrice: number;
  condition: InventoryItem['condition'];
  warehouseLocation?: string;
}

export interface UpdateInventoryItemDto {
  name?: string;
  type?: InventoryItem['type'];
  system?: string;
  manufacturer?: string;
  dimensions?: InventoryItemDimensions;
  quantityAvailable?: number;
  pricePerUnit?: number;
  location?: string;
}

export interface InventorySummary {
  totalItems: number;
  totalValue: number;
  byType: { type: string; count: number }[];
  lowStock: InventoryItem[];
}
