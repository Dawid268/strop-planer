import { Test, TestingModule } from '@nestjs/testing';
import { InventoryService } from './inventory.service';
import { InventoryRepository } from './repositories/inventory.repository';
import { getMapperToken } from '@automapper/nestjs';
import { InventoryItemEntity } from './entities/inventory-item.entity';
import { createMapper, createMap, forMember, mapFrom } from '@automapper/core';
import { classes } from '@automapper/classes';
import { InventoryItemDto, CreateInventoryItemDto } from './dto/inventory.dto';
import { ItemType, ItemCondition } from './enums/inventory.enums';

describe('InventoryService', () => {
  let service: InventoryService;
  let repository: Partial<InventoryRepository>;

  const mockItem: InventoryItemEntity = {
    id: 'item-123',
    name: 'Test Panel',
    catalogCode: 'TEST-001',
    type: ItemType.PANEL,
    system: 'SKYDECK',
    manufacturer: 'PERI',
    quantityAvailable: 100,
    quantityReserved: 0,
    isActive: true,
    weight: 10,
    dailyRentPrice: 5,
    condition: ItemCondition.GOOD,
    createdAt: new Date(),
    updatedAt: new Date(),
    dimensionLength: 150,
    dimensionWidth: 75,
  } as InventoryItemEntity;

  const mockMapper = createMapper({
    strategyInitializer: classes(),
  });

  // Register mappings for tests
  createMap(mockMapper, InventoryItemEntity, InventoryItemDto);
  createMap(
    mockMapper,
    CreateInventoryItemDto,
    InventoryItemEntity,
    forMember(
      (d) => d.dimensionLength,
      mapFrom((s) => s.dimensions?.length),
    ),
    forMember(
      (d) => d.dimensionWidth,
      mapFrom((s) => s.dimensions?.width),
    ),
    forMember(
      (d) => d.dimensionHeight,
      mapFrom((s) => s.dimensions?.height),
    ),
  );

  beforeEach(async () => {
    repository = {
      findAll: jest.fn().mockResolvedValue([mockItem]),
      findById: jest.fn().mockResolvedValue(mockItem),
      create: jest.fn().mockResolvedValue(mockItem),
      update: jest.fn().mockResolvedValue(mockItem),
      delete: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: InventoryRepository, useValue: repository },
        { provide: getMapperToken(), useValue: mockMapper },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  describe('findAll', () => {
    it('should return array of items', async () => {
      const result = await service.findAll();
      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('findOne', () => {
    it('should return item when found', async () => {
      const result = await service.findOne('item-123');
      expect(result).toBeDefined();
      expect(result.id).toBe('item-123');
    });
  });

  describe('create', () => {
    it('should create item', async () => {
      const dto = {
        name: 'New Item',
        catalogCode: 'NEW-001',
        type: ItemType.PANEL,
        system: 'SKYDECK',
        manufacturer: 'PERI',
        quantityAvailable: 50,
        weight: 5,
        dailyRentPrice: 2,
        condition: ItemCondition.NEW,
      };
      (repository.create as jest.Mock).mockResolvedValue({
        ...mockItem,
        ...dto,
      });

      const result = await service.create(dto);
      expect(result).toBeDefined();
      expect(result.name).toBe('New Item');
    });
  });

  describe('update', () => {
    it('should update existing item', async () => {
      const updateDto = { name: 'Updated Name' };
      (repository.findById as jest.Mock).mockResolvedValue(mockItem);
      (repository.update as jest.Mock).mockResolvedValue({
        ...mockItem,
        ...updateDto,
      });

      const result = await service.update('item-123', updateDto);

      expect(result).toBeDefined();
      expect(repository.update).toHaveBeenCalledWith(
        'item-123',
        expect.any(Object),
      );
    });

    it('should throw NotFoundException if item not found', async () => {
      (repository.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('non-existent', { name: 'Test' }),
      ).rejects.toThrow('Element non-existent nie znaleziony');
    });

    it('should throw NotFoundException if update fails', async () => {
      (repository.findById as jest.Mock).mockResolvedValue(mockItem);
      (repository.update as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('item-123', { name: 'Test' }),
      ).rejects.toThrow('Failed to update element item-123');
    });
  });

  describe('delete', () => {
    it('should delete existing item', async () => {
      (repository.delete as jest.Mock).mockResolvedValue(true);

      await expect(service.delete('item-123')).resolves.not.toThrow();
      expect(repository.delete).toHaveBeenCalledWith('item-123');
    });

    it('should throw NotFoundException if item not found', async () => {
      (repository.delete as jest.Mock).mockResolvedValue(false);

      await expect(service.delete('non-existent')).rejects.toThrow(
        'Element non-existent nie znaleziony',
      );
    });
  });

  describe('reserve', () => {
    it('should reserve quantity when available', async () => {
      const itemWithStock = {
        ...mockItem,
        quantityAvailable: 100,
        quantityReserved: 10,
      };
      (repository.findById as jest.Mock).mockResolvedValue(itemWithStock);
      (repository.update as jest.Mock).mockResolvedValue({
        ...itemWithStock,
        quantityReserved: 20,
      });

      const result = await service.reserve('item-123', 10);

      expect(result).toBeDefined();
      expect(repository.update).toHaveBeenCalledWith('item-123', {
        quantityReserved: 20,
      });
    });

    it('should throw NotFoundException if item not found', async () => {
      (repository.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.reserve('non-existent', 10)).rejects.toThrow(
        'Element non-existent nie znaleziony',
      );
    });

    it('should throw error if quantity exceeds available', async () => {
      const itemWithLowStock = {
        ...mockItem,
        quantityAvailable: 10,
        quantityReserved: 5,
      };
      (repository.findById as jest.Mock).mockResolvedValue(itemWithLowStock);

      await expect(service.reserve('item-123', 10)).rejects.toThrow(
        /Niewystarczająca ilość/,
      );
    });
  });

  describe('release', () => {
    it('should release reservation', async () => {
      const itemWithReservation = { ...mockItem, quantityReserved: 20 };
      (repository.findById as jest.Mock).mockResolvedValue(itemWithReservation);
      (repository.update as jest.Mock).mockResolvedValue({
        ...itemWithReservation,
        quantityReserved: 10,
      });

      const result = await service.release('item-123', 10);

      expect(result).toBeDefined();
    });

    it('should throw error if trying to release more than reserved', async () => {
      const itemWithReservation = { ...mockItem, quantityReserved: 5 };
      (repository.findById as jest.Mock).mockResolvedValue(itemWithReservation);

      await expect(service.release('item-123', 10)).rejects.toThrow(
        /Nie można zwolnić/,
      );
    });
  });

  describe('getSummary', () => {
    it('should return inventory summary', async () => {
      const items = [
        {
          ...mockItem,
          type: 'panel',
          system: 'SKYDECK',
          quantityAvailable: 100,
          quantityReserved: 10,
          condition: 'dobra',
          isActive: true,
        },
        {
          ...mockItem,
          id: 'item-2',
          type: 'prop',
          system: 'DOKAFLEX',
          quantityAvailable: 50,
          quantityReserved: 5,
          condition: 'do_naprawy',
          isActive: true,
        },
      ];
      (repository.findAll as jest.Mock).mockResolvedValue(items);

      const result = await service.getSummary();

      expect(result).toBeDefined();
      expect(result.totalItems).toBe(150);
      expect(result.byType).toBeDefined();
      expect(result.bySystem).toBeDefined();
    });

    it('should handle empty inventory', async () => {
      (repository.findAll as jest.Mock).mockResolvedValue([]);

      const result = await service.getSummary();

      expect(result.totalItems).toBe(0);
      expect(result.totalValue).toBe(0);
    });
  });

  describe('getAvailableForProject', () => {
    it('should return available items for project', async () => {
      const activeItems = [
        {
          ...mockItem,
          quantityAvailable: 100,
          quantityReserved: 10,
          isActive: true,
        },
      ];
      (repository.findAll as jest.Mock).mockResolvedValue(activeItems);

      const result = await service.getAvailableForProject(50, 20, 'SKYDECK');

      expect(result).toBeDefined();
      expect(repository.findAll).toHaveBeenCalledWith({
        isActive: true,
        system: 'SKYDECK',
      });
    });

    it('should filter out fully reserved items', async () => {
      const items = [
        { ...mockItem, quantityAvailable: 100, quantityReserved: 100 },
        {
          ...mockItem,
          id: 'item-2',
          quantityAvailable: 50,
          quantityReserved: 10,
        },
      ];
      (repository.findAll as jest.Mock).mockResolvedValue(items);

      const result = await service.getAvailableForProject(50, 20);

      expect(result.length).toBe(1);
    });
  });

  describe('findOne edge cases', () => {
    it('should throw NotFoundException if item not found', async () => {
      (repository.findById as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        'Element non-existent nie znaleziony',
      );
    });
  });
});
