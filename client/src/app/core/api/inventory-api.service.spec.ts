import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { InventoryApiService } from './inventory-api.service';
import { environment } from '@env/environment';
import type {
  InventoryItem,
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  InventorySummary,
} from '@models/inventory.model';

describe('InventoryApiService', () => {
  let service: InventoryApiService;
  let httpMock: HttpTestingController;
  const API_URL = `${environment.apiUrl}/inventory`;

  const mockItem: InventoryItem = {
    id: 'item-1',
    name: 'Panel SKYDECK',
    type: 'panel',
    manufacturer: 'PERI',
    system: 'SKYDECK',
    dimensions: { length: 150, width: 75 },
    quantityAvailable: 100,
    quantityReserved: 20,
    catalogCode: 'SKY-150-75',
    weight: 25.5,
    dailyRentPrice: 1.5,
    condition: 'dobry',
    isActive: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        InventoryApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
        // If InventoryApiService depends on ProjectsService, uncomment and adjust this line:
        // { provide: ProjectsService, useValue: projectsServiceMock },
      ],
    });
    service = TestBed.inject(InventoryApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('getAll', () => {
    it('should be defined', () => {
      expect(service.getAll).toBeDefined();
    });

    it('should send GET to /inventory without filters', () => {
      service.getAll().subscribe((items) => {
        expect(items).toEqual([mockItem]);
      });

      const req = httpMock.expectOne(API_URL);
      expect(req.request.method).toBe('GET');
      req.flush([mockItem]);
    });

    it('should send GET with type filter', () => {
      service.getAll({ type: 'panel' }).subscribe();

      const req = httpMock.expectOne(`${API_URL}?type=panel`);
      expect(req.request.method).toBe('GET');
      req.flush([mockItem]);
    });

    it('should send GET with multiple filters', () => {
      service
        .getAll({ type: 'panel', system: 'SKYDECK', manufacturer: 'PERI' })
        .subscribe();

      const req = httpMock.expectOne(
        (request) =>
          request.url === API_URL &&
          request.params.get('type') === 'panel' &&
          request.params.get('system') === 'SKYDECK' &&
          request.params.get('manufacturer') === 'PERI',
      );
      expect(req.request.method).toBe('GET');
      req.flush([mockItem]);
    });
  });

  describe('getById', () => {
    it('should be defined', () => {
      expect(service.getById).toBeDefined();
    });

    it('should send GET to /inventory/:id', () => {
      service.getById('item-1').subscribe((item) => {
        expect(item).toEqual(mockItem);
      });

      const req = httpMock.expectOne(`${API_URL}/item-1`);
      expect(req.request.method).toBe('GET');
      req.flush(mockItem);
    });

    it('should handle 404', () => {
      service.getById('nonexistent').subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        },
      });

      const req = httpMock.expectOne(`${API_URL}/nonexistent`);
      req.flush('Not found', { status: 404, statusText: 'Not Found' });
    });
  });

  describe('getSummary', () => {
    it('should be defined', () => {
      expect(service.getSummary).toBeDefined();
    });

    it('should send GET to /inventory/summary', () => {
      const mockSummary: InventorySummary = {
        totalItems: 500,
        totalValue: 100000,
        byType: [{ type: 'panel', count: 200 }],
        lowStock: [],
      };

      service.getSummary().subscribe((summary) => {
        expect(summary.totalItems).toBe(500);
      });

      const req = httpMock.expectOne(`${API_URL}/summary`);
      expect(req.request.method).toBe('GET');
      req.flush(mockSummary);
    });
  });

  describe('create', () => {
    it('should be defined', () => {
      expect(service.create).toBeDefined();
    });

    it('should send POST to /inventory with dto', () => {
      const createDto: CreateInventoryItemDto = {
        name: 'New Panel',
        type: 'panel',
        manufacturer: 'DOKA',
        system: 'Dokaflex',
        dimensions: { length: 100, width: 50 },
        quantityAvailable: 50,
        catalogCode: 'DOKA-100-50',
        weight: 15,
        dailyRentPrice: 1.2,
        condition: 'nowy',
      };

      service.create(createDto).subscribe((item) => {
        expect(item.name).toBe('New Panel');
      });

      const req = httpMock.expectOne(API_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(createDto);
      req.flush({ ...mockItem, ...createDto });
    });
  });

  describe('update', () => {
    it('should be defined', () => {
      expect(service.update).toBeDefined();
    });

    it('should send PUT to /inventory/:id with dto', () => {
      const updateDto: UpdateInventoryItemDto = { quantityAvailable: 150 };

      service.update('item-1', updateDto).subscribe((item) => {
        expect(item).toBeDefined();
      });

      const req = httpMock.expectOne(`${API_URL}/item-1`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(updateDto);
      req.flush({ ...mockItem, quantityAvailable: 150 });
    });
  });

  describe('delete', () => {
    it('should be defined', () => {
      expect(service.delete).toBeDefined();
    });

    it('should send DELETE to /inventory/:id', () => {
      service.delete('item-1').subscribe();

      const req = httpMock.expectOne(`${API_URL}/item-1`);
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
    });
  });

  describe('reserve', () => {
    it('should be defined', () => {
      expect(service.reserve).toBeDefined();
    });

    it('should send POST to /inventory/:id/reserve with quantity', () => {
      service.reserve('item-1', 10).subscribe((item) => {
        expect(item).toBeDefined();
      });

      const req = httpMock.expectOne(`${API_URL}/item-1/reserve`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ quantity: 10 });
      req.flush({ ...mockItem, quantityReserved: 30 });
    });
  });

  describe('release', () => {
    it('should be defined', () => {
      expect(service.release).toBeDefined();
    });

    it('should send POST to /inventory/:id/release with quantity', () => {
      service.release('item-1', 5).subscribe((item) => {
        expect(item).toBeDefined();
      });

      const req = httpMock.expectOne(`${API_URL}/item-1/release`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ quantity: 5 });
      req.flush({ ...mockItem, quantityReserved: 15 });
    });
  });
});
