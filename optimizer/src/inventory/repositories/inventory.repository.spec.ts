import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InventoryRepository } from './inventory.repository';
import { InventoryItemEntity } from '../entities/inventory-item.entity';
import { ItemType, ItemCondition } from '../enums/inventory.enums';

describe('InventoryRepository', () => {
  let repository: InventoryRepository;

  const mockQueryBuilder = {
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };

  const mockTypeOrmRepository = {
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockItem: Partial<InventoryItemEntity> = {
    id: 'item-123',
    name: 'Panel P100',
    type: ItemType.PANEL,
    system: 'PERI_SKYDECK',
    quantityAvailable: 10,
    isActive: true,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryRepository,
        {
          provide: getRepositoryToken(InventoryItemEntity),
          useValue: mockTypeOrmRepository,
        },
      ],
    }).compile();

    repository = module.get<InventoryRepository>(InventoryRepository);
  });

  describe('findAll', () => {
    it('should return all items without filter', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockItem]);

      const result = await repository.findAll();

      expect(result).toEqual([mockItem]);
      expect(mockTypeOrmRepository.createQueryBuilder).toHaveBeenCalledWith(
        'item',
      );
    });

    it('should filter by type', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockItem]);

      await repository.findAll({ type: ItemType.PANEL });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'item.type = :type',
        { type: ItemType.PANEL },
      );
    });

    it('should filter by system', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockItem]);

      await repository.findAll({ system: 'PERI_SKYDECK' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'item.system = :system',
        { system: 'PERI_SKYDECK' },
      );
    });

    it('should filter by manufacturer', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await repository.findAll({ manufacturer: 'PERI' });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'item.manufacturer = :manufacturer',
        { manufacturer: 'PERI' },
      );
    });

    it('should filter by minQuantity', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockItem]);

      await repository.findAll({ minQuantity: 5 });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'item.quantityAvailable >= :minQuantity',
        { minQuantity: 5 },
      );
    });

    it('should filter by condition', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockItem]);

      await repository.findAll({ condition: ItemCondition.GOOD });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'item.condition = :condition',
        { condition: ItemCondition.GOOD },
      );
    });

    it('should filter by isActive', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockItem]);

      await repository.findAll({ isActive: true });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'item.isActive = :isActive',
        { isActive: true },
      );
    });

    it('should apply multiple filters', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([mockItem]);

      await repository.findAll({
        type: ItemType.PANEL,
        system: 'PERI_SKYDECK',
        isActive: true,
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(3);
    });
  });

  describe('findById', () => {
    it('should return item by id', async () => {
      mockTypeOrmRepository.findOne.mockResolvedValue(mockItem);

      const result = await repository.findById('item-123');

      expect(result).toEqual(mockItem);
      expect(mockTypeOrmRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'item-123' },
      });
    });

    it('should return null for non-existent item', async () => {
      mockTypeOrmRepository.findOne.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create new item', async () => {
      mockTypeOrmRepository.create.mockReturnValue(mockItem);
      mockTypeOrmRepository.save.mockResolvedValue(mockItem);

      const result = await repository.create(mockItem);

      expect(result).toEqual(mockItem);
      expect(mockTypeOrmRepository.create).toHaveBeenCalledWith(mockItem);
      expect(mockTypeOrmRepository.save).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update item and return updated', async () => {
      mockTypeOrmRepository.update.mockResolvedValue({ affected: 1 });
      mockTypeOrmRepository.findOne.mockResolvedValue({
        ...mockItem,
        quantityAvailable: 20,
      });

      const result = await repository.update('item-123', {
        quantityAvailable: 20,
      });

      expect(result?.quantityAvailable).toBe(20);
      expect(mockTypeOrmRepository.update).toHaveBeenCalledWith('item-123', {
        quantityAvailable: 20,
      });
    });

    it('should return null for non-existent item', async () => {
      mockTypeOrmRepository.update.mockResolvedValue({ affected: 0 });
      mockTypeOrmRepository.findOne.mockResolvedValue(null);

      const result = await repository.update('non-existent', {});

      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should return true when item deleted', async () => {
      mockTypeOrmRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await repository.delete('item-123');

      expect(result).toBe(true);
    });

    it('should return false when item not found', async () => {
      mockTypeOrmRepository.delete.mockResolvedValue({ affected: 0 });

      const result = await repository.delete('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('saveBatch', () => {
    it('should save multiple items', async () => {
      const items = [mockItem, { ...mockItem, id: 'item-456' }];
      mockTypeOrmRepository.save.mockResolvedValue(items);

      await repository.saveBatch(items);

      expect(mockTypeOrmRepository.save).toHaveBeenCalledWith(items);
    });
  });
});
