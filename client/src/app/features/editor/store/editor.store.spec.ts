import 'zone.js';
import 'zone.js/testing';
import { TestBed } from '@angular/core/testing';
import { EditorStore } from './editor.store';
import { ProjectsService } from '../../projects/services/projects.service';
import { FormworkApiService } from '../../projects/services/formwork-api.service';
import { MessageService } from 'primeng/api';
import { of, throwError } from 'rxjs';
import { Shape } from '../models/editor.models';

describe('EditorStore', () => {
  let store: any;
  let projectsServiceMock: jasmine.SpyObj<ProjectsService>;
  let formworkApiServiceMock: jasmine.SpyObj<FormworkApiService>;
  let messageServiceMock: jasmine.SpyObj<MessageService>;

  beforeEach(() => {
    projectsServiceMock = jasmine.createSpyObj('ProjectsService', ['update']);
    formworkApiServiceMock = jasmine.createSpyObj('FormworkApiService', [
      'calculate',
      'optimize',
    ]);
    messageServiceMock = jasmine.createSpyObj('MessageService', ['add']);

    TestBed.configureTestingModule({
      providers: [
        EditorStore,
        { provide: ProjectsService, useValue: projectsServiceMock },
        { provide: FormworkApiService, useValue: formworkApiServiceMock },
        { provide: MessageService, useValue: messageServiceMock },
      ],
    });

    store = TestBed.inject(EditorStore);
  });

  it('should be created', () => {
    expect(store).toBeTruthy();
  });

  it('should initialize with initial state', () => {
    expect(store.shapes()).toEqual([]);
    expect(store.projectId()).toBeNull();
    expect(store.viewMode()).toBe('full');
  });

  describe('setProjectId', () => {
    it('should update projectId', () => {
      store.setProjectId('test-project-123');
      expect(store.projectId()).toBe('test-project-123');
    });
  });

  describe('loadFromProject', () => {
    it('should load shapes and background URL', () => {
      const mockShapes: Shape[] = [
        { id: '1', type: 'slab', x: 0, y: 0, points: [] } as any,
      ];
      const mockBg = 'http://example.com/bg.svg';

      store.loadFromProject(mockShapes, mockBg);

      expect(store.shapes()).toEqual(mockShapes);
      expect(store.backgroundUrl()).toBe(mockBg);
    });
  });

  describe('save', () => {
    it('should NOT call update if projectId is missing', () => {
      store.save();

      expect(projectsServiceMock.update).not.toHaveBeenCalled();
      expect(messageServiceMock.add).toHaveBeenCalledWith(
        jasmine.objectContaining({
          severity: 'error',
          summary: 'Błąd',
          detail: 'Brak ID projektu - nie można zapisać',
        }),
      );
    });

    it('should call projectsService.update with correct payload when successful', () => {
      const projectId = 'project-123';
      const mockShapes: Shape[] = [
        { id: '1', type: 'panel', x: 10, y: 20, width: 100, height: 50 } as any,
      ];
      const slabShapes: Shape[] = [
        {
          id: 'slab-1',
          type: 'slab',
          x: 0,
          y: 0,
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 0, y: 10 },
          ],
        } as any,
      ];

      // Setup state
      store.setProjectId(projectId);
      store.addShape(mockShapes[0]);
      store.addShape(slabShapes[0]);

      projectsServiceMock.update.and.returnValue(of({} as any));

      store.save();

      expect(projectsServiceMock.update).toHaveBeenCalledWith(
        projectId,
        jasmine.objectContaining({
          optimizationResult: jasmine.any(String),
          extractedSlabGeometry: jasmine.any(String),
        }),
      );

      const updateArgs = projectsServiceMock.update.calls.mostRecent().args[1];
      const optResult = JSON.parse(updateArgs.optimizationResult!);
      const slabGeom = JSON.parse(updateArgs.extractedSlabGeometry!);

      expect(optResult.shapes.length).toBe(2);
      expect(slabGeom.polygons.length).toBe(1);
      expect(slabGeom.polygons[0]).toEqual(slabShapes[0].points);

      expect(messageServiceMock.add).toHaveBeenCalledWith(
        jasmine.objectContaining({
          severity: 'success',
          summary: 'Sukces',
        }),
      );
    });

    it('should handle save error', () => {
      store.setProjectId('project-123');
      projectsServiceMock.update.and.returnValue(
        throwError(() => new Error('API Error')),
      );

      store.save();

      expect(messageServiceMock.add).toHaveBeenCalledWith(
        jasmine.objectContaining({
          severity: 'error',
          summary: 'Błąd',
          detail: 'Nie udało się zapisać projektu',
        }),
      );
    });
  });
});
