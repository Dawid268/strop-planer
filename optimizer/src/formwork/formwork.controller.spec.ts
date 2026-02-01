import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { FormworkController } from './formwork.controller';
import { FormworkService } from './formwork.service';

/**
 * Test-specific interface for incomplete CalculateRequest payloads.
 * Used to test validation error handling when required fields are missing.
 */
interface PartialCalculateRequest {
  slabData?: unknown;
  params?: unknown;
}

/**
 * Black-box tests for FormworkController
 * Testing based on endpoint signatures and expected HTTP behavior only
 */
describe('FormworkController', () => {
  let controller: FormworkController;
  let formworkServiceMock: Partial<FormworkService>;

  const mockLayout = {
    id: 'layout-123',
    system: 'PERI_SKYDECK',
    elements: [
      { elementType: 'panel', name: 'Panel 120x60', quantity: 10 },
      { elementType: 'prop', name: 'Stempel 300', quantity: 20 },
    ],
    slabArea: 80,
    estimatedCost: 5000,
    totalWeight: 1500,
  };

  const mockOptimizationResult = {
    originalLayout: mockLayout,
    optimizedLayout: {
      ...mockLayout,
      id: 'optimized-layout-123',
    },
    savings: {
      cost: 500,
      weight: 100,
    },
  };

  beforeEach(async () => {
    formworkServiceMock = {
      calculateFormwork: jest.fn().mockReturnValue(mockLayout),
      optimize: jest.fn().mockReturnValue(mockOptimizationResult),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FormworkController],
      providers: [{ provide: FormworkService, useValue: formworkServiceMock }],
    }).compile();

    controller = module.get<FormworkController>(FormworkController);
  });

  describe('GET /formwork - getStatus()', () => {
    it('should return status ok and systems list', () => {
      const result = controller.getStatus();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('systems');
      expect(result.systems).toBeInstanceOf(Array);
      expect(result.systems.length).toBeGreaterThan(0);
    });
  });

  describe('POST /formwork/calculate - calculateFormwork()', () => {
    const validRequest = {
      slabData: {
        id: 'slab-123',
        dimensions: { length: 10, width: 8, thickness: 0.25, area: 80 },
        type: 'monolityczny' as const,
        beams: [],
        reinforcement: [],
        axes: { horizontal: [], vertical: [] },
      },
      params: {
        slabArea: 80,
        slabThickness: 0.25,
        floorHeight: 3.0,
        includeBeams: true,
      },
    };

    it('should return FormworkLayout on valid request', async () => {
      const result = await controller.calculateFormwork(validRequest);

      expect(result).toBeDefined();
      expect(formworkServiceMock.calculateFormwork).toHaveBeenCalled();
    });

    it('should throw BAD_REQUEST when slabData is missing', async () => {
      const incompleteRequest: PartialCalculateRequest = {
        params: validRequest.params,
      };

      await expect(
        controller.calculateFormwork(incompleteRequest as never),
      ).rejects.toThrow(HttpException);
    });

    it('should throw BAD_REQUEST when params is missing', async () => {
      const incompleteRequest: PartialCalculateRequest = {
        slabData: validRequest.slabData,
      };

      await expect(
        controller.calculateFormwork(incompleteRequest as never),
      ).rejects.toThrow(HttpException);
    });

    it('should cache layout for later retrieval', async () => {
      await controller.calculateFormwork(validRequest);

      // Layout should be accessible via getLayout
      const layout = controller.getLayout(mockLayout.id);
      expect(layout).toBeDefined();
      expect(layout.id).toBe(mockLayout.id);
    });
  });

  describe('POST /formwork/optimize/:layoutId - optimizeFormwork()', () => {
    it('should return OptimizationResult for existing layout', async () => {
      // First create a layout
      await controller.calculateFormwork({
        slabData: {
          id: 'slab-123',
          dimensions: { length: 10, width: 8, thickness: 0.25, area: 80 },
          type: 'monolityczny' as const,
          beams: [],
          reinforcement: [],
          axes: { horizontal: [], vertical: [] },
        },
        params: {
          slabArea: 80,
          slabThickness: 0.25,
          floorHeight: 3.0,
          includeBeams: true,
        },
      });

      const result = await controller.optimizeFormwork(mockLayout.id);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('originalLayout');
      expect(result).toHaveProperty('optimizedLayout');
      expect(result).toHaveProperty('savings');
    });

    it('should throw NOT_FOUND for non-existing layout', async () => {
      await expect(
        controller.optimizeFormwork('non-existing-id'),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('GET /formwork/layout/:layoutId - getLayout()', () => {
    it('should return layout when it exists', async () => {
      // First create a layout
      await controller.calculateFormwork({
        slabData: {
          id: 'slab-123',
          dimensions: { length: 10, width: 8, thickness: 0.25, area: 80 },
          type: 'monolityczny' as const,
          beams: [],
          reinforcement: [],
          axes: { horizontal: [], vertical: [] },
        },
        params: {
          slabArea: 80,
          slabThickness: 0.25,
          floorHeight: 3.0,
          includeBeams: true,
        },
      });

      const result = controller.getLayout(mockLayout.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockLayout.id);
    });

    it('should throw NOT_FOUND for non-existing layout', () => {
      expect(() => controller.getLayout('non-existing-id')).toThrow(
        HttpException,
      );
    });
  });

  describe('GET /formwork/systems - getSystems()', () => {
    it('should return array of systems', () => {
      const result = controller.getSystems();

      expect(result).toHaveProperty('systems');
      expect(result.systems).toBeInstanceOf(Array);
      expect(result.systems.length).toBeGreaterThan(0);
    });

    it('should return systems with required properties', () => {
      const result = controller.getSystems();

      result.systems.forEach((system) => {
        expect(system).toHaveProperty('id');
        expect(system).toHaveProperty('name');
        expect(system).toHaveProperty('manufacturer');
        expect(system).toHaveProperty('description');
      });
    });
  });
});
