export interface InventoryItemDimensions {
  length?: number;
  width?: number;
  height?: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  type: "panel" | "prop" | "beam" | "accessory";
  system: string;
  manufacturer: string;
  dimensions: InventoryItemDimensions;
  quantityAvailable: number; // This is TOTAL quantity in backend logic
  quantityReserved: number;
  dailyRentPrice?: number;
  warehouseLocation?: string;
}

export interface CreateInventoryItemDto {
  name: string;
  type: InventoryItem["type"];
  system: string;
  manufacturer: string;
  dimensions: InventoryItemDimensions;
  quantityAvailable: number;
  pricePerUnit?: number;
  location?: string;
}

export interface UpdateInventoryItemDto {
  name?: string;
  type?: InventoryItem["type"];
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
