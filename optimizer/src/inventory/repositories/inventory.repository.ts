import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryItemEntity } from '@/inventory/entities/inventory-item.entity';
import { InventoryFilter } from '@/inventory/interfaces/inventory.interface';

@Injectable()
export class InventoryRepository {
  constructor(
    @InjectRepository(InventoryItemEntity)
    private readonly repository: Repository<InventoryItemEntity>,
  ) {}

  async findAll(filter?: InventoryFilter): Promise<InventoryItemEntity[]> {
    const query = this.buildFilterQuery(filter);
    return query.getMany();
  }

  async findAllPaginated(
    filter?: InventoryFilter,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ data: InventoryItemEntity[]; total: number }> {
    const query = this.buildFilterQuery(filter);
    query.skip((page - 1) * limit).take(limit);

    const [data, total] = await query.getManyAndCount();
    return { data, total };
  }

  private buildFilterQuery(filter?: InventoryFilter) {
    const query = this.repository.createQueryBuilder('item');

    if (filter) {
      if (filter.type) {
        query.andWhere('item.type = :type', { type: filter.type });
      }
      if (filter.system) {
        query.andWhere('item.system = :system', { system: filter.system });
      }
      if (filter.manufacturer) {
        query.andWhere('item.manufacturer = :manufacturer', {
          manufacturer: filter.manufacturer,
        });
      }
      if (filter.minQuantity !== undefined) {
        query.andWhere('item.quantityAvailable >= :minQuantity', {
          minQuantity: filter.minQuantity,
        });
      }
      if (filter.condition) {
        query.andWhere('item.condition = :condition', {
          condition: filter.condition,
        });
      }
      if (filter.isActive !== undefined) {
        query.andWhere('item.isActive = :isActive', {
          isActive: filter.isActive,
        });
      }
    }

    return query;
  }

  async findById(id: string): Promise<InventoryItemEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  async create(
    data: Partial<InventoryItemEntity>,
  ): Promise<InventoryItemEntity> {
    const item = this.repository.create(data);
    return this.repository.save(item);
  }

  async update(
    id: string,
    data: Partial<InventoryItemEntity>,
  ): Promise<InventoryItemEntity | null> {
    await this.repository.update(id, data);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async saveBatch(items: Partial<InventoryItemEntity>[]): Promise<void> {
    await this.repository.save(items);
  }
}
