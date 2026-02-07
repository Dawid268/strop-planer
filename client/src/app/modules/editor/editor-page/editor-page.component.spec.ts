import 'zone.js';
import 'zone.js/testing';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { EditorPageComponent } from './editor-page.component';
import { EditorStore } from '@stores/editor';
import { ProjectsApiService } from '@api/projects-api.service';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { MessageService } from 'primeng/api';
import { of } from 'rxjs';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

describe('EditorPageComponent', () => {
  let component: EditorPageComponent;
  let fixture: ComponentFixture<EditorPageComponent>;
  let storeMock: Record<string, unknown>;
  let projectsApiMock: jasmine.SpyObj<ProjectsApiService>;

  beforeEach(async () => {
    storeMock = {
      save: jasmine.createSpy('save'),
      setProjectId: jasmine.createSpy('setProjectId'),
      loadFromProject: jasmine.createSpy('loadFromProject'),
      loadEditorData: jasmine.createSpy('loadEditorData'),
      shapes: (): unknown[] => [],
      projectId: (): string | null => null,
      zoom: (): number => 1,
      showGrid: (): boolean => true,
      activeTool: (): string => 'select',
      viewMode: (): string => 'full',
      isSlabDefined: (): boolean => false,
    };

    projectsApiMock = jasmine.createSpyObj('ProjectsApiService', [
      'getById',
      'updateEditorData',
    ]);
    projectsApiMock.getById.and.returnValue(
      of({
        id: 'project-123',
        name: 'Test',
        status: 'draft',
      } as ReturnType<
        ProjectsApiService['getById']
      > extends import('rxjs').Observable<infer T>
        ? T
        : never),
    );

    await TestBed.configureTestingModule({
      imports: [EditorPageComponent],
      providers: [
        { provide: EditorStore, useValue: storeMock },
        { provide: ProjectsApiService, useValue: projectsApiMock },
        { provide: MessageService, useValue: {} },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: 'project-123' }),
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

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set projectId in store on init', () => {
    expect(storeMock.setProjectId).toHaveBeenCalledWith('project-123');
  });

  describe('onSave', () => {
    it('should call store.save()', () => {
      component.onSave();
      expect(storeMock.save).toHaveBeenCalled();
    });
  });
});
