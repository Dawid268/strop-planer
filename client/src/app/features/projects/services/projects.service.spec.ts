import "zone.js";
import "zone.js/testing";
import { TestBed } from "@angular/core/testing";
import { ProjectsService } from "./projects.service";
import { ProjectsApiService } from "./projects-api.service";
import { ProjectsStore } from "../store/projects.store";
import { HttpClientTestingModule } from "@angular/common/http/testing";
import { of } from "rxjs";
import type {
  Project,
  CreateProjectDto,
  UpdateProjectDto,
} from "../models/project.model";

describe("ProjectsService", () => {
  let service: ProjectsService;
  let apiMock: jasmine.SpyObj<ProjectsApiService>;
  let storeMock: any;

  const mockProject: Project = {
    id: "p1",
    name: "Project 1",
    status: "draft",
    slabLength: 10,
    slabWidth: 10,
    slabThickness: 0.2,
    floorHeight: 3,
    slabType: "monolithic",
    slabArea: 100,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    apiMock = jasmine.createSpyObj("ProjectsApiService", [
      "getAll",
      "getById",
      "create",
      "update",
      "delete",
    ]);
    storeMock = jasmine.createSpyObj("ProjectsStore", [
      "addProject",
      "updateProjectState",
      "deleteProject",
    ]);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ProjectsService,
        { provide: ProjectsApiService, useValue: apiMock },
        { provide: ProjectsStore, useValue: storeMock },
      ],
    });

    service = TestBed.inject(ProjectsService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  describe("getProjects", () => {
    it("should call api.getAll", () => {
      apiMock.getAll.and.returnValue(of([mockProject]));
      service.getProjects().subscribe((projects) => {
        expect(projects).toEqual([mockProject]);
        expect(apiMock.getAll).toHaveBeenCalled();
      });
    });
  });

  describe("create", () => {
    it("should call api.create and store.addProject", () => {
      const dto: CreateProjectDto = { name: "New" } as any;
      apiMock.create.and.returnValue(of(mockProject));

      service.create(dto).subscribe((project) => {
        expect(project).toEqual(mockProject);
        expect(apiMock.create).toHaveBeenCalledWith(dto);
        expect(storeMock.addProject).toHaveBeenCalledWith(mockProject);
      });
    });
  });

  describe("update", () => {
    it("should call api.update and store.updateProjectState", () => {
      const dto: UpdateProjectDto = { name: "Updated" };
      apiMock.update.and.returnValue(of(mockProject));

      service.update("p1", dto).subscribe((project) => {
        expect(project).toEqual(mockProject);
        expect(apiMock.update).toHaveBeenCalledWith("p1", dto);
        expect(storeMock.updateProjectState).toHaveBeenCalledWith(mockProject);
      });
    });
  });

  describe("delete", () => {
    it("should call api.delete and store.deleteProject", () => {
      apiMock.delete.and.returnValue(of(undefined));

      service.delete("p1").subscribe(() => {
        expect(apiMock.delete).toHaveBeenCalledWith("p1");
        expect(storeMock.deleteProject).toHaveBeenCalledWith("p1");
      });
    });
  });

  describe("getOne", () => {
    it("should call api.getById", () => {
      apiMock.getById.and.returnValue(of(mockProject));
      service.getOne("p1").subscribe((project) => {
        expect(project).toEqual(mockProject);
        expect(apiMock.getById).toHaveBeenCalledWith("p1");
      });
    });
  });
});
