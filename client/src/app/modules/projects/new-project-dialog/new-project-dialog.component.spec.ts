import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { NewProjectDialogComponent } from './new-project-dialog.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { MessageService } from 'primeng/api';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { ProjectsApiService } from '@api/projects-api.service';
import { of } from 'rxjs';
import { PLATFORM_ID } from '@angular/core';

describe('NewProjectDialogComponent', () => {
  let component: NewProjectDialogComponent;
  let fixture: ComponentFixture<NewProjectDialogComponent>;
  let projectsApi: jest.Mocked<ProjectsApiService>;
  let dialogRef: jest.Mocked<DynamicDialogRef>;

  beforeEach(async () => {
    projectsApi = {
      uploadPdf: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<ProjectsApiService>;
    dialogRef = {
      close: jest.fn(),
    } as unknown as jest.Mocked<DynamicDialogRef>;

    await TestBed.configureTestingModule({
      imports: [
        NewProjectDialogComponent,
        HttpClientTestingModule,
        TranslocoTestingModule.forRoot({
          langs: { pl: {}, en: {} },
          translocoConfig: {
            availableLangs: ['pl', 'en'],
            defaultLang: 'pl',
          },
        }),
      ],
      providers: [
        { provide: ProjectsApiService, useValue: projectsApi },
        { provide: DynamicDialogRef, useValue: dialogRef },
        { provide: PLATFORM_ID, useValue: 'browser' },
        MessageService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NewProjectDialogComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should handle file selection', () => {
    const file = new File([''], 'test.pdf', { type: 'application/pdf' });
    projectsApi.uploadPdf.mockReturnValue(
      of({ paths: { pdf: 'path/to/pdf' } }),
    );

    (component as unknown as { handleFile: (file: File) => void }).handleFile(
      file,
    );

    expect(component['selectedPdfFiles']()).toEqual([file]);
    expect(projectsApi.uploadPdf).toHaveBeenCalled();
  });

  it('should validate form correctly', () => {
    expect(component.isValid()).toBeFalsy();

    component.updateName('Test Project');
    expect(component.isValid()).toBeFalsy();

    (
      component as unknown as {
        selectedPdfFiles: { set: (files: File[]) => void };
      }
    ).selectedPdfFiles.set([new File([''], 'test.pdf')]);
    expect(component.isValid()).toBeTruthy();
  });

  it('should submit form and attach uploaded paths to project (DXF flow)', fakeAsync(() => {
    const mockProject = { id: '123', name: 'Test' };
    const updatedProject = {
      ...mockProject,
      sourcePdfPath: 'path/to/pdf',
      dxfPath: 'path/to/dxf',
      geoJsonPath: 'path/to/json',
    };
    component.updateName('Test Project');
    (
      component as unknown as {
        selectedPdfFiles: { set: (files: File[]) => void };
      }
    ).selectedPdfFiles.set([new File([''], 'test.pdf')]);
    (
      component as unknown as {
        store: {
          uploadedPaths: () => { pdf: string; dxf: string; json: string };
        };
      }
    ).store.uploadedPaths = (): { pdf: string; dxf: string; json: string } => ({
      pdf: 'path/to/pdf',
      dxf: 'path/to/dxf',
      json: 'path/to/json',
    });

    projectsApi.create.mockReturnValue(
      of(
        mockProject as unknown as ReturnType<
          ProjectsApiService['create']
        > extends import('rxjs').Observable<infer T>
          ? T
          : never,
      ),
    );
    projectsApi.update.mockReturnValue(
      of(
        updatedProject as unknown as ReturnType<
          ProjectsApiService['update']
        > extends import('rxjs').Observable<infer T>
          ? T
          : never,
      ),
    );

    component.submit();
    tick(600);

    expect(projectsApi.create).toHaveBeenCalled();
    expect(projectsApi.update).toHaveBeenCalledWith('123', {
      sourcePdfPath: 'path/to/pdf',
      dxfPath: 'path/to/dxf',
      geoJsonPath: 'path/to/json',
    });
    expect(dialogRef.close).toHaveBeenCalled();
  }));
});
