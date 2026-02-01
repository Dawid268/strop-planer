import { TestBed, fakeAsync, tick } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { ProjectsService } from "./projects.service";
import { ProjectsApiService } from "./projects-api.service";
import { ProjectsStore } from "../store/projects.store";
import { environment } from "@env/environment";
import { of } from "rxjs";
import { Project, CreateProjectDto, Job } from "../models/project.model";

describe("ProjectsService (Black-box)", () => {
  let service: ProjectsService;
  let httpMock: HttpTestingController;
  let apiSpy: jest.Mocked<ProjectsApiService>;
  let storeSpy: jest.Mocked<ProjectsStore>;
  const API_URL = environment.apiUrl;

  beforeEach(() => {
    const apiMock = {
      getAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getById: jest.fn(),
    };

    const storeMock = {
      addProject: jest.fn(),
      updateProjectState: jest.fn(),
      setProjects: jest.fn(),
      deleteProject: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        ProjectsService,
        { provide: ProjectsApiService, useValue: apiMock },
        { provide: ProjectsStore, useValue: storeMock },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(ProjectsService);
    httpMock = TestBed.inject(HttpTestingController);
    apiSpy = TestBed.inject(
      ProjectsApiService,
    ) as jest.Mocked<ProjectsApiService>;
    storeSpy = TestBed.inject(ProjectsStore) as jest.Mocked<ProjectsStore>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe("create", () => {
    it("should call api.create and update store", () => {
      const dto: CreateProjectDto = { name: "Test Project" };
      const mockProject = { id: "1", ...dto } as Project;
      apiSpy.create.mockReturnValue(of(mockProject));

      service.create(dto).subscribe((project) => {
        expect(project).toEqual(mockProject);
        expect(storeSpy.addProject).toHaveBeenCalledWith(mockProject);
      });
    });
  });

  describe("uploadPdf", () => {
    it("should send POST with FormData", () => {
      const projectId = "1";
      const file = new File(["test"], "test.pdf", { type: "application/pdf" });

      service.uploadPdf(projectId, file).subscribe();

      const req = httpMock.expectOne(`${API_URL}/pdf/upload/${projectId}`);
      expect(req.request.method).toBe("POST");
      expect(req.request.body instanceof FormData).toBe(true);
      req.flush({ success: true });
    });
  });

  describe("extractGeometry", () => {
    it("should start extraction and poll for status", fakeAsync(() => {
      const pdfPath = "/uploads/test.pdf";
      const projectId = "1";
      const jobId = "job123";
      let result: Job | undefined;

      // Mock start response
      const startResponse = {
        data: { jobId },
        status: "success",
        message: "",
        timestamp: new Date(),
      };

      // Mock polling responses
      const jobPending: Job = {
        id: jobId,
        status: "pending",
        message: "P",
        createdAt: new Date(),
      };
      const jobCompleted: Job = {
        id: jobId,
        status: "completed",
        message: "C",
        createdAt: new Date(),
      };

      service.extractGeometry(pdfPath, projectId).subscribe((job) => {
        result = job;
      });

      // Handle start request
      const startReq = httpMock.expectOne(`${API_URL}/geometry/extract`);
      expect(startReq.request.body).toEqual({ pdfPath, projectId });
      startReq.flush(startResponse);

      tick(); // allow timer(0, 2000) to fire immediately

      // Handle first poll
      const poll1 = httpMock.expectOne(`${API_URL}/geometry/jobs/${jobId}`);
      poll1.flush({ data: jobPending });

      tick(2000); // wait for next interval

      // Handle second poll
      const poll2 = httpMock.expectOne(`${API_URL}/geometry/jobs/${jobId}`);
      poll2.flush({ data: jobCompleted });

      expect(result).toEqual(jobCompleted);
    }));
  });
});
