import { TestBed } from "@angular/core/testing";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { provideHttpClient } from "@angular/common/http";
import { provideZonelessChangeDetection } from "@angular/core";
import {
  PdfApiService,
  ExtractedPdfData,
  BatchUploadResult,
  DrawingType,
} from "./pdf-api.service";
import { environment } from "../../../../environments/environment";

describe("PdfApiService", () => {
  let service: PdfApiService;
  let httpMock: HttpTestingController;
  const API_URL = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        PdfApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(PdfApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe("uploadPdfSimple", () => {
    it("should be defined", () => {
      expect(service.uploadPdfSimple).toBeDefined();
    });

    it("should send POST to /pdf/upload with file in FormData", () => {
      const mockFile = new File(["test"], "test.pdf", {
        type: "application/pdf",
      });
      const mockResponse: ExtractedPdfData = {
        sourceFile: "test.pdf",
        extractedAt: new Date(),
        rawText: "test content",
        warnings: [],
      };

      service.uploadPdfSimple(mockFile).subscribe((response) => {
        expect(response).toEqual(mockResponse);
      });

      const req = httpMock.expectOne(`${API_URL}/pdf/upload`);
      expect(req.request.method).toBe("POST");
      expect(req.request.body instanceof FormData).toBeTrue();
      req.flush(mockResponse);
    });

    it("should handle server error", () => {
      const mockFile = new File(["test"], "test.pdf", {
        type: "application/pdf",
      });

      service.uploadPdfSimple(mockFile).subscribe({
        error: (err) => {
          expect(err.status).toBe(500);
        },
      });

      const req = httpMock.expectOne(`${API_URL}/pdf/upload`);
      req.flush("Error", { status: 500, statusText: "Server Error" });
    });
  });

  describe("uploadBatch", () => {
    it("should be defined", () => {
      expect(service.uploadBatch).toBeDefined();
    });

    it("should send POST to /pdf/upload-batch with multiple files", () => {
      const mockFiles = [
        new File(["test1"], "strop.pdf", { type: "application/pdf" }),
        new File(["test2"], "konstrukcja.pdf", { type: "application/pdf" }),
      ];
      const mockResponse: BatchUploadResult = {
        files: [
          {
            fileName: "strop.pdf",
            drawingType: "slab",
            confidence: 95,
            isRecommended: true,
            extractedData: null,
          },
          {
            fileName: "konstrukcja.pdf",
            drawingType: "structure",
            confidence: 85,
            isRecommended: true,
            extractedData: null,
          },
        ],
        recommendedFiles: ["strop.pdf", "konstrukcja.pdf"],
        totalFiles: 2,
        successfullyParsed: 2,
      };

      service.uploadBatch(mockFiles).subscribe((response) => {
        expect(response.totalFiles).toBe(2);
        expect(response.files.length).toBe(2);
        expect(response.recommendedFiles).toContain("strop.pdf");
      });

      const req = httpMock.expectOne(`${API_URL}/pdf/upload-batch`);
      expect(req.request.method).toBe("POST");
      expect(req.request.body instanceof FormData).toBeTrue();
      req.flush(mockResponse);
    });

    it("should handle empty file array", () => {
      const mockResponse: BatchUploadResult = {
        files: [],
        recommendedFiles: [],
        totalFiles: 0,
        successfullyParsed: 0,
      };

      service.uploadBatch([]).subscribe((response) => {
        expect(response.totalFiles).toBe(0);
      });

      const req = httpMock.expectOne(`${API_URL}/pdf/upload-batch`);
      req.flush(mockResponse);
    });
  });

  describe("uploadPdf (with progress)", () => {
    it("should be defined", () => {
      expect(service.uploadPdf).toBeDefined();
    });

    it("should return observable of UploadResponse type", () => {
      const mockFile = new File(["test"], "test.pdf", {
        type: "application/pdf",
      });

      service.uploadPdf(mockFile).subscribe((response) => {
        expect(response.type).toBeDefined();
        expect(["progress", "complete"]).toContain(response.type);
      });

      const req = httpMock.expectOne(`${API_URL}/pdf/upload`);
      expect(req.request.method).toBe("POST");
      req.flush({
        sourceFile: "test.pdf",
        extractedAt: new Date(),
        rawText: "",
        warnings: [],
      });
    });
  });

  describe("getDrawingTypeLabel", () => {
    it("should be defined", () => {
      expect(service.getDrawingTypeLabel).toBeDefined();
    });

    it("should return 'Strop' for 'slab'", () => {
      expect(service.getDrawingTypeLabel("slab")).toBe("Strop");
    });

    it("should return 'Konstrukcja' for 'structure'", () => {
      expect(service.getDrawingTypeLabel("structure")).toBe("Konstrukcja");
    });

    it("should return 'Zbrojenie' for 'reinforcement'", () => {
      expect(service.getDrawingTypeLabel("reinforcement")).toBe("Zbrojenie");
    });

    it("should return 'Architektura' for 'architecture'", () => {
      expect(service.getDrawingTypeLabel("architecture")).toBe("Architektura");
    });

    it("should return 'Więźba' for 'roof'", () => {
      expect(service.getDrawingTypeLabel("roof")).toBe("Więźba");
    });

    it("should return 'Fundamenty' for 'foundation'", () => {
      expect(service.getDrawingTypeLabel("foundation")).toBe("Fundamenty");
    });

    it("should return 'Inne' for 'other'", () => {
      expect(service.getDrawingTypeLabel("other")).toBe("Inne");
    });

    it("should handle all DrawingType values", () => {
      const types: DrawingType[] = [
        "slab",
        "structure",
        "reinforcement",
        "architecture",
        "roof",
        "foundation",
        "other",
      ];
      types.forEach((type) => {
        const label = service.getDrawingTypeLabel(type);
        expect(label).toBeDefined();
        expect(typeof label).toBe("string");
        expect(label.length).toBeGreaterThan(0);
      });
    });
  });
});
