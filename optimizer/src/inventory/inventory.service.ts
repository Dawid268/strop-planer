/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  InventoryFilterDto,
} from '@/inventory/dto/inventory.dto';
import { InventorySummary } from '@/inventory/interfaces/inventory.interface';
import { InventoryItemEntity } from '@/inventory/entities/inventory-item.entity';
import { InventoryRepository } from '@/inventory/repositories/inventory.repository';
import { Mapper } from '@automapper/core';
import { InjectMapper } from '@automapper/nestjs';
import { InventoryItemDto } from '@/inventory/dto/inventory.dto';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  public constructor(
    private readonly repository: InventoryRepository,
    @InjectMapper() private readonly mapper: Mapper,
  ) {}

  public async findAll(
    filter?: InventoryFilterDto,
  ): Promise<InventoryItemDto[]> {
    const items = await this.repository.findAll(filter);
    return this.mapper.mapArrayAsync(
      items,
      InventoryItemEntity,
      InventoryItemDto,
    );
  }

  public async findAllPaginated(
    filter?: InventoryFilterDto,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: InventoryItemDto[]; total: number }> {
    const { data, total } = await this.repository.findAllPaginated(
      filter,
      page,
      limit,
    );
    const mappedData = await this.mapper.mapArrayAsync(
      data,
      InventoryItemEntity,
      InventoryItemDto,
    );
    return { data: mappedData, total };
  }

  /**
   * Pobiera element po ID
   */
  public async findOne(id: string): Promise<InventoryItemDto> {
    const item = await this.repository.findById(id);
    if (!item) {
      throw new NotFoundException(`Element ${id} nie znaleziony`);
    }
    return this.mapper.mapAsync(item, InventoryItemEntity, InventoryItemDto);
  }

  /**
   * Tworzy nowy element magazynowy
   */
  public async create(dto: CreateInventoryItemDto): Promise<InventoryItemDto> {
    const itemData = this.mapper.map(
      dto,
      CreateInventoryItemDto,
      InventoryItemEntity,
    );
    itemData.isActive = true;
    itemData.quantityReserved = 0;

    const item = await this.repository.create(itemData);
    this.logger.log(`Created inventory item: ${item.id} - ${item.name}`);

    return this.mapper.mapAsync(item, InventoryItemEntity, InventoryItemDto);
  }

  /**
   * Aktualizuje element magazynowy
   */
  public async update(
    id: string,
    dto: UpdateInventoryItemDto,
  ): Promise<InventoryItemDto> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Element ${id} nie znaleziony`);
    }

    const updated = await this.repository.update(id, {
      ...existing,
      ...dto,
    });

    if (!updated) {
      throw new NotFoundException(`Failed to update element ${id}`);
    }

    this.logger.log(`Updated inventory item: ${id}`);
    return this.mapper.mapAsync(updated, InventoryItemEntity, InventoryItemDto);
  }

  /**
   * Usuwa element magazynowy
   */
  public async delete(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) {
      throw new NotFoundException(`Element ${id} nie znaleziony`);
    }
    this.logger.log(`Deleted inventory item: ${id}`);
  }

  /**
   * Rezerwuje określoną ilość elementów
   */
  public async reserve(
    id: string,
    quantity: number,
  ): Promise<InventoryItemDto> {
    const item = await this.repository.findById(id);
    if (!item) {
      throw new NotFoundException(`Element ${id} nie znaleziony`);
    }

    const available = item.quantityAvailable - item.quantityReserved;

    if (quantity > available) {
      throw new Error(
        `Niewystarczająca ilość. Dostępne: ${available}, wymagane: ${quantity}`,
      );
    }

    item.quantityReserved += quantity;
    const updated = await this.repository.update(id, {
      quantityReserved: item.quantityReserved,
    });

    return this.mapper.mapAsync(
      updated!,
      InventoryItemEntity,
      InventoryItemDto,
    );
  }

  /**
   * Zwalnia rezerwację
   */
  public async release(
    id: string,
    quantity: number,
  ): Promise<InventoryItemEntity> {
    const item = await this.findOne(id);

    if (quantity > item.quantityReserved) {
      throw new Error(
        `Nie można zwolnić ${quantity} szt. Zarezerwowano: ${item.quantityReserved}`,
      );
    }

    item.quantityReserved -= quantity;
    return this.repository.update(id, {
      quantityReserved: item.quantityReserved,
    }) as Promise<InventoryItemEntity>;
  }

  /**
   * Pobiera podsumowanie magazynu
   */
  public async getSummary(): Promise<InventorySummary> {
    const items = await this.repository.findAll();

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
      totalItems: items.reduce(
        (sum: number, item: InventoryItemEntity) =>
          sum + item.quantityAvailable,
        0,
      ),
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
  public async getAvailableForProject(
    _requiredPanelArea: number,
    _requiredProps: number,
    preferredSystem?: string,
  ): Promise<InventoryItemDto[]> {
    const items = await this.repository.findAll({
      isActive: true,
      system: preferredSystem,
    });

    const filtered = items.filter(
      (item: InventoryItemEntity) =>
        item.quantityAvailable - item.quantityReserved > 0,
    );

    return this.mapper.mapArrayAsync(
      filtered,
      InventoryItemEntity,
      InventoryItemDto,
    );
  }
}
