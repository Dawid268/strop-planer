import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  InventoryItem,
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  InventoryFilter,
  InventorySummary,
} from './interfaces/inventory.interface';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);
  private readonly items: Map<string, InventoryItem> = new Map();

  public constructor() {
    // Załaduj przykładowe dane demo
    this.seedDemoData();
  }

  /**
   * Pobiera wszystkie elementy magazynowe
   */
  public findAll(filter?: InventoryFilter): InventoryItem[] {
    let items = Array.from(this.items.values());

    if (filter) {
      if (filter.type) {
        items = items.filter((item) => item.type === filter.type);
      }
      if (filter.system) {
        items = items.filter((item) => item.system === filter.system);
      }
      if (filter.manufacturer) {
        items = items.filter(
          (item) => item.manufacturer === filter.manufacturer,
        );
      }
      if (filter.minQuantity !== undefined) {
        items = items.filter(
          (item) => item.quantityAvailable >= filter.minQuantity!,
        );
      }
      if (filter.condition) {
        items = items.filter((item) => item.condition === filter.condition);
      }
      if (filter.isActive !== undefined) {
        items = items.filter((item) => item.isActive === filter.isActive);
      }
    }

    return items;
  }

  /**
   * Pobiera element po ID
   */
  public findOne(id: string): InventoryItem {
    const item = this.items.get(id);
    if (!item) {
      throw new NotFoundException(`Element ${id} nie znaleziony`);
    }
    return item;
  }

  /**
   * Tworzy nowy element magazynowy
   */
  public create(dto: CreateInventoryItemDto): InventoryItem {
    const id = `INV_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    const item: InventoryItem = {
      id,
      catalogCode: dto.catalogCode,
      name: dto.name,
      type: dto.type,
      system: dto.system,
      manufacturer: dto.manufacturer,
      dimensions: dto.dimensions || {},
      quantityAvailable: dto.quantityAvailable,
      quantityReserved: 0,
      loadCapacity: dto.loadCapacity,
      weight: dto.weight,
      dailyRentPrice: dto.dailyRentPrice,
      condition: dto.condition || 'dobry',
      warehouseLocation: dto.warehouseLocation,
      isActive: true,
      notes: dto.notes,
    };

    this.items.set(id, item);
    this.logger.log(`Created inventory item: ${id} - ${item.name}`);

    return item;
  }

  /**
   * Aktualizuje element magazynowy
   */
  public update(id: string, dto: UpdateInventoryItemDto): InventoryItem {
    const existing = this.findOne(id);

    const updated: InventoryItem = {
      ...existing,
      ...dto,
      id, // ID nie może być zmienione
    };

    this.items.set(id, updated);
    this.logger.log(`Updated inventory item: ${id}`);

    return updated;
  }

  /**
   * Usuwa element magazynowy
   */
  public delete(id: string): void {
    if (!this.items.has(id)) {
      throw new NotFoundException(`Element ${id} nie znaleziony`);
    }
    this.items.delete(id);
    this.logger.log(`Deleted inventory item: ${id}`);
  }

  /**
   * Rezerwuje określoną ilość elementów
   */
  public reserve(id: string, quantity: number): InventoryItem {
    const item = this.findOne(id);
    const available = item.quantityAvailable - item.quantityReserved;

    if (quantity > available) {
      throw new Error(
        `Niewystarczająca ilość. Dostępne: ${available}, wymagane: ${quantity}`,
      );
    }

    item.quantityReserved += quantity;
    this.items.set(id, item);

    return item;
  }

  /**
   * Zwalnia rezerwację
   */
  public release(id: string, quantity: number): InventoryItem {
    const item = this.findOne(id);

    if (quantity > item.quantityReserved) {
      throw new Error(
        `Nie można zwolnić ${quantity} szt. Zarezerwowano: ${item.quantityReserved}`,
      );
    }

    item.quantityReserved -= quantity;
    this.items.set(id, item);

    return item;
  }

  /**
   * Pobiera podsumowanie magazynu
   */
  public getSummary(): InventorySummary {
    const items = Array.from(this.items.values());

    const byType: Record<string, number> = {};
    const bySystem: Record<string, number> = {};
    let totalValue = 0;
    let available = 0;
    let reserved = 0;
    let underRepair = 0;

    for (const item of items) {
      // Grupuj po typie
      byType[item.type] = (byType[item.type] || 0) + item.quantityAvailable;

      // Grupuj po systemie
      bySystem[item.system] =
        (bySystem[item.system] || 0) + item.quantityAvailable;

      // Oblicz wartość (przybliżona na podstawie ceny wynajmu)
      totalValue += item.quantityAvailable * item.dailyRentPrice * 365;

      if (item.condition === 'do_naprawy') {
        underRepair += item.quantityAvailable;
      } else if (item.isActive) {
        available += item.quantityAvailable - item.quantityReserved;
        reserved += item.quantityReserved;
      }
    }

    return {
      totalItems: items.reduce((sum, item) => sum + item.quantityAvailable, 0),
      totalValue,
      byType,
      bySystem,
      availableForRent: available,
      reserved,
      underRepair,
    };
  }

  /**
   * Pobiera elementy dostępne dla danego projektu
   */
  public getAvailableForProject(
    requiredPanelArea: number,
    requiredProps: number,
    preferredSystem?: string,
  ): InventoryItem[] {
    let items = this.findAll({ isActive: true });

    if (preferredSystem) {
      items = items.filter((item) => item.system === preferredSystem);
    }

    // Filtruj tylko te, które mają dostępną ilość
    return items.filter(
      (item) => item.quantityAvailable - item.quantityReserved > 0,
    );
  }

  /**
   * Inicjalizuje dane demo
   */
  private seedDemoData(): void {
    const demoItems: CreateInventoryItemDto[] = [
      // Panele PERI SKYDECK
      {
        catalogCode: 'PERI-SKY-150x75',
        name: 'Panel SKYDECK 150x75cm',
        type: 'panel',
        system: 'PERI_SKYDECK',
        manufacturer: 'PERI',
        dimensions: { length: 150, width: 75 },
        quantityAvailable: 200,
        loadCapacity: 75,
        weight: 14.5,
        dailyRentPrice: 2.5,
        condition: 'dobry',
        warehouseLocation: 'A1-01',
      },
      {
        catalogCode: 'PERI-SKY-125x75',
        name: 'Panel SKYDECK 125x75cm',
        type: 'panel',
        system: 'PERI_SKYDECK',
        manufacturer: 'PERI',
        dimensions: { length: 125, width: 75 },
        quantityAvailable: 150,
        loadCapacity: 75,
        weight: 12.0,
        dailyRentPrice: 2.2,
        condition: 'dobry',
        warehouseLocation: 'A1-02',
      },
      {
        catalogCode: 'PERI-SKY-100x75',
        name: 'Panel SKYDECK 100x75cm',
        type: 'panel',
        system: 'PERI_SKYDECK',
        manufacturer: 'PERI',
        dimensions: { length: 100, width: 75 },
        quantityAvailable: 100,
        loadCapacity: 75,
        weight: 10.0,
        dailyRentPrice: 1.8,
        condition: 'dobry',
        warehouseLocation: 'A1-03',
      },
      // Stojaki
      {
        catalogCode: 'PERI-PROP-250-400',
        name: 'Stojak eurostempel 250-400cm',
        type: 'prop',
        system: 'PERI_SKYDECK',
        manufacturer: 'PERI',
        dimensions: { height: 400 },
        quantityAvailable: 500,
        loadCapacity: 30,
        weight: 14,
        dailyRentPrice: 0.8,
        condition: 'dobry',
        warehouseLocation: 'B1-01',
      },
      {
        catalogCode: 'PERI-PROP-200-350',
        name: 'Stojak eurostempel 200-350cm',
        type: 'prop',
        system: 'PERI_SKYDECK',
        manufacturer: 'PERI',
        dimensions: { height: 350 },
        quantityAvailable: 400,
        loadCapacity: 30,
        weight: 12,
        dailyRentPrice: 0.7,
        condition: 'dobry',
        warehouseLocation: 'B1-02',
      },
      // Głowice
      {
        catalogCode: 'PERI-DH-001',
        name: 'Głowica opadająca',
        type: 'drophead',
        system: 'PERI_SKYDECK',
        manufacturer: 'PERI',
        dimensions: {},
        quantityAvailable: 600,
        weight: 2.5,
        dailyRentPrice: 0.3,
        condition: 'dobry',
        warehouseLocation: 'C1-01',
      },
      // Trójnogi
      {
        catalogCode: 'PERI-TRI-001',
        name: 'Trójnóg stabilizujący',
        type: 'tripod',
        system: 'PERI_SKYDECK',
        manufacturer: 'PERI',
        dimensions: {},
        quantityAvailable: 300,
        weight: 5,
        dailyRentPrice: 0.2,
        condition: 'dobry',
        warehouseLocation: 'C1-02',
      },
      // DOKA
      {
        catalogCode: 'DOKA-DFX-200x50',
        name: 'Panel Dokaflex 200x50cm',
        type: 'panel',
        system: 'DOKA_DOKAFLEX',
        manufacturer: 'DOKA',
        dimensions: { length: 200, width: 50 },
        quantityAvailable: 100,
        loadCapacity: 70,
        weight: 18.0,
        dailyRentPrice: 2.8,
        condition: 'dobry',
        warehouseLocation: 'A2-01',
      },
      // Dźwigary
      {
        catalogCode: 'DOKA-H20-270',
        name: 'Dźwigar H20 L=270cm',
        type: 'beam',
        system: 'DOKA_DOKAFLEX',
        manufacturer: 'DOKA',
        dimensions: { length: 270 },
        quantityAvailable: 200,
        weight: 9.5,
        dailyRentPrice: 0.5,
        condition: 'dobry',
        warehouseLocation: 'D1-01',
      },
    ];

    for (const dto of demoItems) {
      this.create(dto);
    }

    this.logger.log(`Seeded ${demoItems.length} demo inventory items`);
  }
}
