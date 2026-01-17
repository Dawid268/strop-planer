import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { InventoryService } from "./inventory";
import type {
  InventoryItemDto,
  InventorySummaryDto,
  CreateInventoryItemDto,
} from "../../shared/dto";

describe("InventoryService", () => {
  let service: InventoryService;
  let httpMock: HttpTestingController;

  const mockInventoryItem: InventoryItemDto = {
    id: "test-id-1",
    catalogCode: "PERI-SKY-150x75",
    name: "Panel SKYDECK 150x75cm",
    type: "panel",
    system: "PERI_SKYDECK",
    manufacturer: "PERI",
    dimensions: { length: 150, width: 75, height: null },
    quantityAvailable: 200,
    quantityReserved: 0,
    loadCapacity: 75,
    weight: 14.5,
    dailyRentPrice: 2.5,
    condition: "dobry",
    warehouseLocation: "A1-01",
    isActive: true,
    notes: null,
  };

  const mockSummary: InventorySummaryDto = {
    totalItems: 2550,
    totalValue: 843150,
    byType: { panel: 550, prop: 900 },
    bySystem: { PERI_SKYDECK: 2250 },
    availableForRent: 2550,
    reserved: 0,
    underRepair: 0,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        InventoryService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(InventoryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  describe("getAll", () => {
    it("should fetch all inventory items", () => {
      const items = [mockInventoryItem];

      service.getAll().subscribe((data) => {
        expect(data).toEqual(items);
        expect(data.length).toBe(1);
      });

      const req = httpMock.expectOne("http://localhost:3000/inventory");
      expect(req.request.method).toBe("GET");
      req.flush(items);
    });

    it("should apply filters as query params", () => {
      service.getAll({ type: "panel", system: "PERI_SKYDECK" }).subscribe();

      const req = httpMock.expectOne(
        (request) =>
          request.url === "http://localhost:3000/inventory" &&
          request.params.get("type") === "panel" &&
          request.params.get("system") === "PERI_SKYDECK"
      );
      expect(req.request.method).toBe("GET");
      req.flush([]);
    });
  });

  describe("getById", () => {
    it("should fetch single inventory item by id", () => {
      service.getById("test-id-1").subscribe((data) => {
        expect(data).toEqual(mockInventoryItem);
      });

      const req = httpMock.expectOne(
        "http://localhost:3000/inventory/test-id-1"
      );
      expect(req.request.method).toBe("GET");
      req.flush(mockInventoryItem);
    });
  });

  describe("getSummary", () => {
    it("should fetch inventory summary", () => {
      service.getSummary().subscribe((data) => {
        expect(data).toEqual(mockSummary);
        expect(data.totalItems).toBe(2550);
      });

      const req = httpMock.expectOne("http://localhost:3000/inventory/summary");
      expect(req.request.method).toBe("GET");
      req.flush(mockSummary);
    });
  });

  describe("create", () => {
    it("should create new inventory item", () => {
      const createDto: CreateInventoryItemDto = {
        catalogCode: "NEW-001",
        name: "New Item",
        type: "panel",
        system: "PERI_SKYDECK",
        manufacturer: "PERI",
        quantityAvailable: 100,
        weight: 10,
        dailyRentPrice: 2.0,
      };

      const createdItem: InventoryItemDto = {
        ...mockInventoryItem,
        id: "new-id",
        ...createDto,
      };

      service.create(createDto).subscribe((data) => {
        expect(data.catalogCode).toBe("NEW-001");
      });

      const req = httpMock.expectOne("http://localhost:3000/inventory");
      expect(req.request.method).toBe("POST");
      expect(req.request.body).toEqual(createDto);
      req.flush(createdItem);
    });
  });

  describe("reserve", () => {
    it("should reserve inventory items", () => {
      service.reserve("test-id-1", 10).subscribe((data) => {
        expect(data.quantityReserved).toBe(10);
      });

      const req = httpMock.expectOne(
        "http://localhost:3000/inventory/test-id-1/reserve"
      );
      expect(req.request.method).toBe("POST");
      expect(req.request.body).toEqual({ quantity: 10 });
      req.flush({ ...mockInventoryItem, quantityReserved: 10 });
    });
  });

  describe("release", () => {
    it("should release reserved inventory items", () => {
      service.release("test-id-1", 5).subscribe((data) => {
        expect(data.quantityReserved).toBe(5);
      });

      const req = httpMock.expectOne(
        "http://localhost:3000/inventory/test-id-1/release"
      );
      expect(req.request.method).toBe("POST");
      expect(req.request.body).toEqual({ quantity: 5 });
      req.flush({ ...mockInventoryItem, quantityReserved: 5 });
    });
  });
});
