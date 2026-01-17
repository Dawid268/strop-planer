import { Test, TestingModule } from '@nestjs/testing';
import { FormworkService } from './formwork.service';

/**
 * Black-box tests for FormworkService
 * Testing based on method signatures and expected behavior only
 */
describe('FormworkService', () => {
  let service: FormworkService;

  const mockSlabData = {
    id: 'slab-123',
    dimensions: { length: 10, width: 8, thickness: 0.25, area: 80 },
    type: 'monolityczny' as const,
    beams: [],
    reinforcement: [],
    axes: { horizontal: [], vertical: [] },
  };

  const mockParams = {
    slabArea: 80,
    slabThickness: 0.25,
    floorHeight: 3.0,
    includeBeams: true,
    preferredSystem: 'PERI_SKYDECK' as const,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FormworkService],
    }).compile();

    service = module.get<FormworkService>(FormworkService);
  });

  describe('calculateFormwork(slabData, params): FormworkLayout', () => {
    it('should return FormworkLayout object with required properties', () => {
      const result = service.calculateFormwork(mockSlabData, mockParams);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('system');
      expect(result).toHaveProperty('elements');
      expect(result).toHaveProperty('slabArea');
    });

    it('should calculate elements array with valid element objects', () => {
      const result = service.calculateFormwork(mockSlabData, mockParams);

      expect(result.elements).toBeInstanceOf(Array);
      expect(result.elements.length).toBeGreaterThan(0);
      if (result.elements.length > 0) {
        expect(result.elements[0]).toHaveProperty('elementType');
        expect(result.elements[0]).toHaveProperty('name');
        expect(result.elements[0]).toHaveProperty('quantity');
      }
    });

    it('should include panel elements in calculation', () => {
      const result = service.calculateFormwork(mockSlabData, mockParams);

      const panels = result.elements.filter(
        (el: any) => el.elementType === 'panel',
      );
      expect(panels.length).toBeGreaterThan(0);
    });

    it('should include prop elements in calculation', () => {
      const result = service.calculateFormwork(mockSlabData, mockParams);

      const props = result.elements.filter(
        (el: any) => el.elementType === 'prop',
      );
      expect(props.length).toBeGreaterThan(0);
    });

    it('should use preferred system when specified', () => {
      const result = service.calculateFormwork(mockSlabData, mockParams);

      expect(result.system).toBe('PERI_SKYDECK');
    });

    it('should calculate slabArea correctly', () => {
      const result = service.calculateFormwork(mockSlabData, mockParams);

      expect(result.slabArea).toBe(80);
    });

    it('should include estimated cost', () => {
      const result = service.calculateFormwork(mockSlabData, mockParams);

      expect(result).toHaveProperty('estimatedCost');
      expect(typeof result.estimatedCost).toBe('number');
      expect(result.estimatedCost).toBeGreaterThan(0);
    });

    it('should include total weight', () => {
      const result = service.calculateFormwork(mockSlabData, mockParams);

      expect(result).toHaveProperty('totalWeight');
      expect(typeof result.totalWeight).toBe('number');
    });
  });

  describe('optimize(layout: FormworkLayout): OptimizationResult', () => {
    it('should return OptimizationResult object', () => {
      const layout = service.calculateFormwork(mockSlabData, mockParams);

      const result = service.optimize(layout);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('originalLayout');
      expect(result).toHaveProperty('optimizedLayout');
      expect(result).toHaveProperty('savings');
    });

    it('should return savings object with numeric values', () => {
      const layout = service.calculateFormwork(mockSlabData, mockParams);

      const result = service.optimize(layout);

      expect(result.savings).toBeDefined();
      expect(typeof result.savings).toBe('object');
    });

    it('should return optimized layout with elements', () => {
      const layout = service.calculateFormwork(mockSlabData, mockParams);

      const result = service.optimize(layout);

      expect(result.optimizedLayout).toHaveProperty('elements');
      expect(result.optimizedLayout.elements).toBeInstanceOf(Array);
    });
  });
});
