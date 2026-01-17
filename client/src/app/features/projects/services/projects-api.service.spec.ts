import { TestBed } from "@angular/core/testing";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { provideHttpClient } from "@angular/common/http";
import { provideZonelessChangeDetection } from "@angular/core";
import { ProjectsApiService } from "./projects-api.service";
import { environment } from "../../../../environments/environment";
import type {
  Project,
  CreateProjectDto,
  UpdateProjectDto,
  ProjectStats,
} from "../models/project.model";

describe("ProjectsApiService", () => {
  let service: ProjectsApiService;
  let httpMock: HttpTestingController;
  const API_URL = `${environment.apiUrl}/projects`;

  const mockProject: Project = {
    id: "project-1",
    name: "Test Project",
    description: "Test description",
    status: "draft",
    slabLength: 10,
    slabWidth: 8,
    slabThickness: 0.25,
    floorHeight: 3,
    slabType: "monolithic",
    slabArea: 80,
    formworkSystem: "PERI_SKYDECK",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ProjectsApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ProjectsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe("getAll", () => {
    it("should be defined", () => {
      expect(service.getAll).toBeDefined();
    });

    it("should send GET to /projects", () => {
      const mockProjects: Project[] = [mockProject];

      service.getAll().subscribe((projects) => {
        expect(projects).toEqual(mockProjects);
        expect(projects.length).toBe(1);
      });

      const req = httpMock.expectOne(API_URL);
      expect(req.request.method).toBe("GET");
      req.flush(mockProjects);
    });

    it("should return empty array when no projects", () => {
      service.getAll().subscribe((projects) => {
        expect(projects).toEqual([]);
      });

      const req = httpMock.expectOne(API_URL);
      req.flush([]);
    });
  });

  describe("getById", () => {
    it("should be defined", () => {
      expect(service.getById).toBeDefined();
    });

    it("should send GET to /projects/:id", () => {
      service.getById("project-1").subscribe((project) => {
        expect(project).toEqual(mockProject);
      });

      const req = httpMock.expectOne(`${API_URL}/project-1`);
      expect(req.request.method).toBe("GET");
      req.flush(mockProject);
    });

    it("should handle 404 when project not found", () => {
      service.getById("nonexistent").subscribe({
        error: (err) => {
          expect(err.status).toBe(404);
        },
      });

      const req = httpMock.expectOne(`${API_URL}/nonexistent`);
      req.flush("Not found", { status: 404, statusText: "Not Found" });
    });
  });

  describe("getStats", () => {
    it("should be defined", () => {
      expect(service.getStats).toBeDefined();
    });

    it("should send GET to /projects/stats", () => {
      const mockStats: ProjectStats = {
        totalProjects: 10,
        draftCount: 3,
        completedCount: 5,
        totalArea: 1000,
      };

      service.getStats().subscribe((stats) => {
        expect(stats.totalProjects).toBe(10);
      });

      const req = httpMock.expectOne(`${API_URL}/stats`);
      expect(req.request.method).toBe("GET");
      req.flush(mockStats);
    });
  });

  describe("create", () => {
    it("should be defined", () => {
      expect(service.create).toBeDefined();
    });

    it("should send POST to /projects with dto", () => {
      const createDto: CreateProjectDto = {
        name: "New Project",
        description: "Description",
        slabLength: 12,
        slabWidth: 10,
        slabThickness: 0.3,
        floorHeight: 3.5,
        slabType: "monolithic",
        formworkSystem: "",
      };

      service.create(createDto).subscribe((project) => {
        expect(project.name).toBe("New Project");
      });

      const req = httpMock.expectOne(API_URL);
      expect(req.request.method).toBe("POST");
      expect(req.request.body).toEqual(createDto);
      req.flush({ ...mockProject, ...createDto, slabArea: 120 });
    });
  });

  describe("update", () => {
    it("should be defined", () => {
      expect(service.update).toBeDefined();
    });

    it("should send PUT to /projects/:id with dto", () => {
      const updateDto: UpdateProjectDto = { name: "Updated Name" };

      service.update("project-1", updateDto).subscribe((project) => {
        expect(project.name).toBe("Updated Name");
      });

      const req = httpMock.expectOne(`${API_URL}/project-1`);
      expect(req.request.method).toBe("PUT");
      expect(req.request.body).toEqual(updateDto);
      req.flush({ ...mockProject, name: "Updated Name" });
    });
  });

  describe("delete", () => {
    it("should be defined", () => {
      expect(service.delete).toBeDefined();
    });

    it("should send DELETE to /projects/:id", () => {
      service.delete("project-1").subscribe(() => {
        expect(true).toBeTrue();
      });

      const req = httpMock.expectOne(`${API_URL}/project-1`);
      expect(req.request.method).toBe("DELETE");
      req.flush(null);
    });
  });

  describe("saveCalculation", () => {
    it("should be defined", () => {
      expect(service.saveCalculation).toBeDefined();
    });

    it("should send POST to /projects/:id/calculation", () => {
      const calcResult = { panels: 100, beams: 50 };

      service.saveCalculation("project-1", calcResult).subscribe((project) => {
        expect(project).toBeDefined();
      });

      const req = httpMock.expectOne(`${API_URL}/project-1/calculation`);
      expect(req.request.method).toBe("POST");
      expect(req.request.body.result).toEqual(calcResult);
      req.flush(mockProject);
    });
  });

  describe("saveOptimization", () => {
    it("should be defined", () => {
      expect(service.saveOptimization).toBeDefined();
    });

    it("should send POST to /projects/:id/optimization", () => {
      const optimResult = { layout: [], efficiency: 95 };

      service
        .saveOptimization("project-1", optimResult)
        .subscribe((project) => {
          expect(project).toBeDefined();
        });

      const req = httpMock.expectOne(`${API_URL}/project-1/optimization`);
      expect(req.request.method).toBe("POST");
      expect(req.request.body.result).toEqual(optimResult);
      req.flush(mockProject);
    });
  });
});
