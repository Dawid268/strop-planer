/**
 * DTO dla elementu magazynowego
 * Odzwierciedla strukturę danych z API NestJS
 */

export interface InventoryItemDto {
  readonly id: string;
  readonly catalogCode: string;
  readonly name: string;
  readonly type: InventoryItemType;
  readonly system: string;
  readonly manufacturer: string;
  readonly dimensions: InventoryDimensionsDto;
  readonly quantityAvailable: number;
  readonly quantityReserved: number;
  readonly loadCapacity: number | null;
  readonly weight: number;
  readonly dailyRentPrice: number;
  readonly condition: InventoryCondition;
  readonly warehouseLocation: string | null;
  readonly isActive: boolean;
  readonly notes: string | null;
}

export interface InventoryDimensionsDto {
  readonly length: number | null;
  readonly width: number | null;
  readonly height: number | null;
}

export interface CreateInventoryItemDto {
  readonly catalogCode: string;
  readonly name: string;
  readonly type: InventoryItemType;
  readonly system: string;
  readonly manufacturer: string;
  readonly dimensions?: InventoryDimensionsDto;
  readonly quantityAvailable: number;
  readonly loadCapacity?: number;
  readonly weight: number;
  readonly dailyRentPrice: number;
  readonly condition?: InventoryCondition;
  readonly warehouseLocation?: string;
  readonly notes?: string;
}

export interface UpdateInventoryItemDto {
  readonly catalogCode?: string;
  readonly name?: string;
  readonly type?: InventoryItemType;
  readonly system?: string;
  readonly manufacturer?: string;
  readonly dimensions?: InventoryDimensionsDto;
  readonly quantityAvailable?: number;
  readonly quantityReserved?: number;
  readonly loadCapacity?: number;
  readonly weight?: number;
  readonly dailyRentPrice?: number;
  readonly condition?: InventoryCondition;
  readonly warehouseLocation?: string;
  readonly isActive?: boolean;
  readonly notes?: string;
}

export interface InventorySummaryDto {
  readonly totalItems: number;
  readonly totalValue: number;
  readonly byType: Record<string, number>;
  readonly bySystem: Record<string, number>;
  readonly availableForRent: number;
  readonly reserved: number;
  readonly underRepair: number;
}

export interface InventoryFilterDto {
  readonly type?: InventoryItemType;
  readonly system?: string;
  readonly manufacturer?: string;
  readonly minQuantity?: number;
  readonly condition?: InventoryCondition;
  readonly isActive?: boolean;
}

export type InventoryItemType =
  | 'panel'
  | 'prop'
  | 'beam'
  | 'head'
  | 'tripod'
  | 'drophead'
  | 'accessory';

export type InventoryCondition = 'nowy' | 'dobry' | 'używany' | 'do_naprawy';

export const INVENTORY_ITEM_TYPES: readonly InventoryItemType[] = [
  'panel',
  'prop',
  'beam',
  'head',
  'tripod',
  'drophead',
  'accessory',
] as const;

export const INVENTORY_CONDITIONS: readonly InventoryCondition[] = [
  'nowy',
  'dobry',
  'używany',
  'do_naprawy',
] as const;
