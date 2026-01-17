import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service';

/**
 * Integration tests for InventoryService (uses internal Map storage)
 * Testing based on method signatures and actual InventoryItem interface
 */
describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InventoryService],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  describe('findAll(filter?: InventoryFilter): InventoryItem[]', () => {
    it('should return array of inventory items (seeded data)', () => {
      const result = service.findAll();

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should filter by type when filter provided', () => {
      const result = service.findAll({ type: 'panel' });

      expect(result).toBeDefined();
      expect(result.every((item) => item.type === 'panel')).toBe(true);
    });

    it('should filter by system when filter provided', () => {
      const result = service.findAll({ system: 'SKYDECK' });

      expect(result).toBeDefined();
      if (result.length > 0) {
        expect(result.every((item) => item.system === 'SKYDECK')).toBe(true);
      }
    });

    it('should filter by manufacturer when filter provided', () => {
      const result = service.findAll({ manufacturer: 'PERI' });

      expect(result).toBeDefined();
      if (result.length > 0) {
        expect(result.every((item) => item.manufacturer === 'PERI')).toBe(true);
      }
    });
  });

  describe('findOne(id: string): InventoryItem', () => {
    it('should return item when found', () => {
      // Get first item from seeded data
      const allItems = service.findAll();
      if (allItems.length > 0) {
        const result = service.findOne(allItems[0].id);

        expect(result).toBeDefined();
        expect(result.id).toBe(allItems[0].id);
      }
    });

    it('should throw NotFoundException when item not found', () => {
      expect(() => service.findOne('non-existent-id')).toThrow(
        NotFoundException,
      );
    });
  });

  describe('create(dto: CreateInventoryItemDto): InventoryItem', () => {
    it('should create and return new inventory item with required properties', () => {
      const createDto = {
        catalogCode: 'SKD-100-60',
        name: 'Test Panel TDD',
        type: 'panel' as const,
        system: 'SKYDECK',
        manufacturer: 'PERI',
        dimensions: { length: 90, width: 60 },
        quantityAvailable: 30,
        weight: 8.5,
        dailyRentPrice: 25,
      };

      const result = service.create(createDto);

      expect(result).toBeDefined();
      expect(result.name).toBe('Test Panel TDD');
      expect(result.catalogCode).toBe('SKD-100-60');
      expect(result.id).toBeDefined();
    });

    it('should set quantityReserved to 0 initially', () => {
      const createDto = {
        catalogCode: 'SKD-TEST-2',
        name: 'Test Panel Zero',
        type: 'panel' as const,
        system: 'MULTIFLEX',
        manufacturer: 'PERI',
        quantityAvailable: 50,
        weight: 10,
        dailyRentPrice: 30,
      };

      const result = service.create(createDto);

      expect(result.quantityReserved).toBe(0);
    });
  });

  describe('update(id: string, dto: UpdateInventoryItemDto): InventoryItem', () => {
    it('should update and return modified item', () => {
      // Create item first
      const created = service.create({
        catalogCode: 'UPD-TEST-01',
        name: 'Update Test',
        type: 'panel' as const,
        system: 'SKYDECK',
        manufacturer: 'PERI',
        quantityAvailable: 20,
        weight: 9,
        dailyRentPrice: 22,
      });

      const result = service.update(created.id, { quantityAvailable: 60 });

      expect(result.quantityAvailable).toBe(60);
      expect(result.id).toBe(created.id);
    });

    it('should throw NotFoundException when item does not exist', () => {
      expect(() =>
        service.update('non-existent', { quantityAvailable: 10 }),
      ).toThrow(NotFoundException);
    });
  });

  describe('delete(id: string): void', () => {
    it('should delete item without error', () => {
      // Create item first
      const created = service.create({
        catalogCode: 'DEL-TEST-01',
        name: 'Delete Test',
        type: 'prop' as const,
        system: 'SKYDECK',
        manufacturer: 'PERI',
        quantityAvailable: 10,
        weight: 5,
        dailyRentPrice: 15,
      });

      expect(() => service.delete(created.id)).not.toThrow();

      // Verify deleted
      expect(() => service.findOne(created.id)).toThrow(NotFoundException);
    });

    it('should throw NotFoundException when item does not exist', () => {
      expect(() => service.delete('non-existent')).toThrow(NotFoundException);
    });
  });

  describe('reserve(id: string, quantity: number): InventoryItem', () => {
    it('should reserve items and update quantityReserved', () => {
      // Create item first
      const created = service.create({
        catalogCode: 'RES-TEST-01',
        name: 'Reserve Test',
        type: 'panel' as const,
        system: 'SKYDECK',
        manufacturer: 'PERI',
        quantityAvailable: 50,
        weight: 8,
        dailyRentPrice: 25,
      });

      const result = service.reserve(created.id, 10);

      expect(result.quantityReserved).toBe(10);
    });

    it('should throw error when quantity exceeds available', () => {
      const created = service.create({
        catalogCode: 'RES-OVER-01',
        name: 'Reserve Overflow Test',
        type: 'panel' as const,
        system: 'SKYDECK',
        manufacturer: 'PERI',
        quantityAvailable: 10,
        weight: 8,
        dailyRentPrice: 25,
      });

      expect(() => service.reserve(created.id, 100)).toThrow();
    });
  });

  describe('release(id: string, quantity: number): InventoryItem', () => {
    it('should release reserved items and update quantityReserved', () => {
      // Create and reserve first
      const created = service.create({
        catalogCode: 'REL-TEST-01',
        name: 'Release Test',
        type: 'panel' as const,
        system: 'SKYDECK',
        manufacturer: 'PERI',
        quantityAvailable: 50,
        weight: 8,
        dailyRentPrice: 25,
      });
      service.reserve(created.id, 20);

      const result = service.release(created.id, 10);

      expect(result.quantityReserved).toBe(10);
    });

    it('should throw error when quantity exceeds reserved', () => {
      const created = service.create({
        catalogCode: 'REL-OVER-01',
        name: 'Release Overflow Test',
        type: 'panel' as const,
        system: 'SKYDECK',
        manufacturer: 'PERI',
        quantityAvailable: 10,
        weight: 8,
        dailyRentPrice: 25,
      });

      expect(() => service.release(created.id, 100)).toThrow();
    });
  });

  describe('getSummary(): InventorySummary', () => {
    it('should return summary with required properties', () => {
      const result = service.getSummary();

      expect(result).toHaveProperty('totalItems');
      expect(result).toHaveProperty('byType');
      expect(result.totalItems).toBeGreaterThan(0);
    });

    it('should return totalValue number', () => {
      const result = service.getSummary();

      expect(result).toHaveProperty('totalValue');
      expect(typeof result.totalValue).toBe('number');
    });
  });

  describe('getAvailableForProject(panelArea, props, system?): InventoryItem[]', () => {
    it('should return list of available items for project requirements', () => {
      const result = service.getAvailableForProject(100, 20);

      expect(result).toBeInstanceOf(Array);
    });

    it('should filter by system when provided', () => {
      const result = service.getAvailableForProject(100, 20, 'SKYDECK');

      expect(result).toBeDefined();
      if (result.length > 0) {
        expect(result.every((item) => item.system === 'SKYDECK')).toBe(true);
      }
    });
  });
});
