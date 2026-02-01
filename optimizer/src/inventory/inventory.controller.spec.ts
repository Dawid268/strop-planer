/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { BadRequestException } from '@nestjs/common';
import {
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  InventoryItemDto,
  InventoryFilterDto,
} from './dto/inventory.dto';
import { ItemType, ItemCondition } from './enums/inventory.enums';

describe('InventoryController', () => {
  let controller: InventoryController;
  let inventoryService: InventoryService;

  const mockItemDto: InventoryItemDto = {
    id: 'item-123',
    catalogCode: 'PERI-001',
    name: 'Panel Skydeck 75x75',
    type: ItemType.PANEL,
    system: 'PERI_SKYDECK',
    manufacturer: 'PERI',
    quantityAvailable: 80,
    quantityReserved: 20,
    weight: 5.5,
    dailyRentPrice: 2.5,
    loadCapacity: 50,
    condition: ItemCondition.GOOD,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSummary = {
    totalItems: 500,
    totalValue: 75000,
    byType: { panel: 300, prop: 200 },
    bySystem: { PERI_SKYDECK: 400, DOKA_DOKAFLEX: 100 },
    lowStock: [],
  };

  const mockInventoryService = {
    findAll: jest.fn().mockResolvedValue([mockItemDto]),
    findAllPaginated: jest
      .fn()
      .mockResolvedValue({ data: [mockItemDto], total: 1 }),
    findOne: jest.fn().mockResolvedValue(mockItemDto),
    create: jest.fn().mockResolvedValue(mockItemDto),
    update: jest.fn().mockResolvedValue(mockItemDto),
    delete: jest.fn().mockResolvedValue(undefined),
    getSummary: jest.fn().mockResolvedValue(mockSummary),
    reserve: jest.fn().mockResolvedValue(mockItemDto),
    release: jest.fn().mockResolvedValue(mockItemDto),
    getAvailableForProject: jest.fn().mockResolvedValue([mockItemDto]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        {
          provide: InventoryService,
          useValue: mockInventoryService,
        },
      ],
    }).compile();

    controller = module.get<InventoryController>(InventoryController);
    inventoryService = module.get<InventoryService>(InventoryService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated list of inventory items', async () => {
      const filter: InventoryFilterDto = { type: ItemType.PANEL };
      const pagination = { page: 1, limit: 20 };

      const result = await controller.findAll(filter, pagination);

      expect(inventoryService.findAllPaginated).toHaveBeenCalledWith(
        filter,
        1,
        20,
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('item-123');
      expect(result.meta.total).toBe(1);
    });
  });

  describe('getSummary', () => {
    it('should return inventory summary', async () => {
      const result = await controller.getSummary();

      expect(inventoryService.getSummary).toHaveBeenCalled();
      expect(result.totalItems).toBe(500);
    });
  });

  describe('findOne', () => {
    it('should return item by id', async () => {
      const result = await controller.findOne('item-123');

      expect(inventoryService.findOne).toHaveBeenCalledWith('item-123');
      expect(result.id).toBe('item-123');
    });
  });

  describe('create', () => {
    it('should create a new inventory item', async () => {
      const dto: CreateInventoryItemDto = {
        catalogCode: 'PERI-002',
        name: 'New Panel',
        type: ItemType.PANEL,
        system: 'PERI_SKYDECK',
        manufacturer: 'PERI',
        quantityAvailable: 50,
        weight: 5,
        dailyRentPrice: 2,
        condition: ItemCondition.NEW,
      };

      const result = await controller.create(dto);

      expect(inventoryService.create).toHaveBeenCalledWith(dto);
      expect(result.id).toBe('item-123');
    });
  });

  describe('update', () => {
    it('should update inventory item', async () => {
      const dto: UpdateInventoryItemDto = {
        name: 'Updated Panel',
        quantityAvailable: 120,
      };

      const result = await controller.update('item-123', dto);

      expect(inventoryService.update).toHaveBeenCalledWith('item-123', dto);
      expect(result.id).toBe('item-123');
    });
  });

  describe('delete', () => {
    it('should delete inventory item', async () => {
      const result = await controller.delete('item-123');

      expect(inventoryService.delete).toHaveBeenCalledWith('item-123');
      expect(result.message).toContain('usunięty');
    });
  });

  describe('reserve', () => {
    it('should reserve inventory items', async () => {
      const result = await controller.reserve('item-123', 10);

      expect(inventoryService.reserve).toHaveBeenCalledWith('item-123', 10);
      expect(result.id).toBe('item-123');
    });

    it('should throw BadRequestException for invalid quantity', async () => {
      await expect(controller.reserve('item-123', 0)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.reserve('item-123', -5)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('release', () => {
    it('should release reserved items', async () => {
      const result = await controller.release('item-123', 5);

      expect(inventoryService.release).toHaveBeenCalledWith('item-123', 5);
      expect(result.id).toBe('item-123');
    });

    it('should throw BadRequestException for invalid quantity', async () => {
      await expect(controller.release('item-123', 0)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getAvailableForProject', () => {
    it('should return available items for project', async () => {
      const result = await controller.getAvailableForProject(
        100,
        50,
        'PERI_SKYDECK',
      );

      expect(inventoryService.getAvailableForProject).toHaveBeenCalledWith(
        100,
        50,
        'PERI_SKYDECK',
      );
      expect(result).toHaveLength(1);
    });
  });
});
