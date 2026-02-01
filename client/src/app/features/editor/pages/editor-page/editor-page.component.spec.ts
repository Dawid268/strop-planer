import "zone.js";
import "zone.js/testing";
import { TestBed, ComponentFixture } from "@angular/core/testing";
import { EditorPageComponent } from "./editor-page.component";
import { EditorStore } from "../../store/editor.store";
import { ProjectsService } from "../../../projects/services/projects.service";
import { ActivatedRoute, convertToParamMap } from "@angular/router";
import { MessageService } from "primeng/api";
import { of } from "rxjs";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { provideHttpClient } from "@angular/common/http";

describe("EditorPageComponent", () => {
  let component: EditorPageComponent;
  let fixture: ComponentFixture<EditorPageComponent>;
  let storeMock: any;
  let projectsServiceMock: jasmine.SpyObj<ProjectsService>;

  beforeEach(async () => {
    storeMock = {
      save: jasmine.createSpy("save"),
      setProjectId: jasmine.createSpy("setProjectId"),
      loadFromProject: jasmine.createSpy("loadFromProject"),
      shapes: () => [],
      projectId: () => null,
      zoom: () => 1,
      showGrid: () => true,
      activeTool: () => "select",
      viewMode: () => "full",
      isSlabDefined: () => false,
    };

    projectsServiceMock = jasmine.createSpyObj("ProjectsService", [
      "getById",
      "update",
    ]);
    projectsServiceMock.getById.and.returnValue(
      of({
        id: "project-123",
        name: "Test",
        status: "draft",
      } as any),
    );

    await TestBed.configureTestingModule({
      imports: [EditorPageComponent],
      providers: [
        { provide: EditorStore, useValue: storeMock },
        { provide: ProjectsService, useValue: projectsServiceMock },
        { provide: MessageService, useValue: {} },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: "project-123" }),
              queryParamMap: convertToParamMap({}),
            },
          },
        },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EditorPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should set projectId in store on init", () => {
    expect(storeMock.setProjectId).toHaveBeenCalledWith("project-123");
  });

  describe("onSave", () => {
    it("should call store.save()", () => {
      component.onSave();
      expect(storeMock.save).toHaveBeenCalled();
    });
  });
});
