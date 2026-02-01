import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { FormworkService } from './formwork';
import type {
  FormworkLayoutDto,
  FormworkSystemDto,
  CalculateFormworkRequestDto,
} from '../../shared/dto';

describe('FormworkService', () => {
  let service: FormworkService;
  let httpMock: HttpTestingController;

  const mockLayout: FormworkLayoutDto = {
    id: 'layout-1',
    projectName: 'Test Project',
    system: 'PERI_SKYDECK',
    slabArea: 120,
    floorHeight: 280,
    elements: [],
    totalWeight: 1500,
    estimatedCost: 5000,
    estimatedAssemblyTime: 40,
  };

  const mockSystems: ReadonlyArray<FormworkSystemDto> = [
    {
      id: 'PERI_SKYDECK',
      name: 'SKYDECK',
      manufacturer: 'PERI',
      description: 'System aluminiowych paneli',
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FormworkService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(FormworkService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getSystems', () => {
    it('should fetch available formwork systems', () => {
      service.getSystems().subscribe((data) => {
        expect(data.systems).toEqual(mockSystems);
      });

      const req = httpMock.expectOne('http://localhost:3000/formwork/systems');
      expect(req.request.method).toBe('GET');
      req.flush({ systems: mockSystems });
    });
  });

  describe('calculate', () => {
    it('should calculate formwork layout', () => {
      const request: CalculateFormworkRequestDto = {
        slabData: {
          id: 'STROP_1',
          dimensions: { length: 12, width: 10, thickness: 20, area: 120 },
          type: 'monolityczny',
          beams: [],
          reinforcement: [],
          axes: { horizontal: ['1', '2', '3'], vertical: ['A', 'B'] },
        },
        params: {
          slabArea: 120,
          slabThickness: 20,
          floorHeight: 280,
          includeBeams: true,
        },
      };

      service.calculate(request).subscribe((data) => {
        expect(data).toEqual(mockLayout);
      });

      const req = httpMock.expectOne(
        'http://localhost:3000/formwork/calculate',
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush(mockLayout);
    });
  });

  describe('optimize', () => {
    it('should optimize formwork layout', () => {
      const optimizationResult = {
        originalLayout: mockLayout,
        optimizedLayout: mockLayout,
        areaSavings: 5,
        costSavings: 10,
        elementReduction: 3,
        recommendations: ['Test recommendation'],
        alternatives: [],
      };

      service.optimize('layout-1').subscribe((data) => {
        expect(data.costSavings).toBe(10);
      });

      const req = httpMock.expectOne(
        'http://localhost:3000/formwork/optimize/layout-1',
      );
      expect(req.request.method).toBe('POST');
      req.flush(optimizationResult);
    });
  });

  describe('getLayout', () => {
    it('should fetch layout by id', () => {
      service.getLayout('layout-1').subscribe((data) => {
        expect(data).toEqual(mockLayout);
      });

      const req = httpMock.expectOne(
        'http://localhost:3000/formwork/layout/layout-1',
      );
      expect(req.request.method).toBe('GET');
      req.flush(mockLayout);
    });
  });
});
