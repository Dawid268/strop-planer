import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from "@angular/core/testing";
import { NewProjectDialogComponent } from "./new-project-dialog.component";
import { HttpClientTestingModule } from "@angular/common/http/testing";
import { DynamicDialogRef } from "primeng/dynamicdialog";
import { MessageService } from "primeng/api";
import { TranslocoTestingModule } from "@jsverse/transloco";
import { ProjectsService } from "../../services/projects.service";
import { of } from "rxjs";
import { PLATFORM_ID } from "@angular/core";

describe("NewProjectDialogComponent", () => {
  let component: NewProjectDialogComponent;
  let fixture: ComponentFixture<NewProjectDialogComponent>;
  let projectsService: jest.Mocked<ProjectsService>;
  let dialogRef: jest.Mocked<DynamicDialogRef>;

  beforeEach(async () => {
    projectsService = {
      uploadPdf: jest.fn(),
      create: jest.fn(),
      extractGeometry: jest.fn(),
    } as any;
    dialogRef = {
      close: jest.fn(),
    } as any;

    await TestBed.configureTestingModule({
      imports: [
        NewProjectDialogComponent,
        HttpClientTestingModule,
        TranslocoTestingModule.forRoot({
          langs: { pl: {}, en: {} },
          translocoConfig: {
            availableLangs: ["pl", "en"],
            defaultLang: "pl",
          },
        }),
      ],
      providers: [
        { provide: ProjectsService, useValue: projectsService },
        { provide: DynamicDialogRef, useValue: dialogRef },
        { provide: PLATFORM_ID, useValue: "browser" },
        MessageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewProjectDialogComponent);
    component = fixture.componentInstance;
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });

  it("should handle file selection", () => {
    const file = new File([""], "test.pdf", { type: "application/pdf" });
    projectsService.uploadPdf.mockReturnValue(
      of({ data: { paths: { pdf: "path/to/pdf" } } } as any),
    );

    (component as any).handleFile(file);

    expect(component["selectedPdfFiles"]()).toEqual([file]);
    expect(projectsService.uploadPdf).toHaveBeenCalled();
  });

  it("should validate form correctly", () => {
    expect(component.isValid()).toBeFalsy();

    component.updateName("Test Project");
    expect(component.isValid()).toBeFalsy();

    (component as any).selectedPdfFiles.set([new File([""], "test.pdf")]);
    expect(component.isValid()).toBeTruthy();
  });

  it("should submit form and trigger geometry extraction", fakeAsync(() => {
    const mockProject = { id: "123", name: "Test" };
    component.updateName("Test Project");
    (component as any).selectedPdfFiles.set([new File([""], "test.pdf")]);
    (component as any).project.update((p: any) => ({
      ...p,
      sourcePdfPath: "path/to/pdf",
    }));

    projectsService.create.mockReturnValue(of(mockProject as any));
    projectsService.extractGeometry.mockReturnValue(
      of({ result: "geometry" } as any),
    );

    component.submit();
    tick(600);

    expect(projectsService.create).toHaveBeenCalled();
    expect(projectsService.extractGeometry).toHaveBeenCalled();
    expect(dialogRef.close).toHaveBeenCalled();
  }));
});
