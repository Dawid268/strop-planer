import {
  Component,
  inject,
  viewChild,
  ElementRef,
  effect,
  AfterViewInit,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToolbarModule } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { CheckboxModule } from 'primeng/checkbox';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { FloorPlanStore } from '@stores/floor-plan.store';
import type { DxfData, SelectedEntity } from '@models/floor-plan.model';
import { Shape } from '@models/editor.models';

@Component({
  selector: 'app-floor-plan-dxf-viewer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ToolbarModule,
    ButtonModule,
    ProgressBarModule,
    CheckboxModule,
    ProgressSpinnerModule,
    TooltipModule,
  ],
  templateUrl: './floor-plan-dxf-viewer.component.html',
  styleUrl: './floor-plan-dxf-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FloorPlanDxfViewerComponent implements AfterViewInit {
  protected readonly store = inject(FloorPlanStore);
  protected readonly canvasContainer = viewChild<ElementRef>('canvasContainer');

  // Store signals exposed to template
  protected readonly currentDocument = this.store.document;
  protected readonly isLoading = this.store.loading;
  protected readonly error = this.store.error;
  protected readonly layers = this.store.layers;
  protected readonly entityCount = this.store.entityCount;
  protected readonly showGrid = this.store.showGrid;
  protected readonly selectedEntity = this.store.selectedEntity;
  protected readonly isSelectionMode = this.store.isSelectionMode;

  // Upload progress (local state for UI feedback)
  protected readonly uploadProgress = signal(0);

  // THREE.js private state
  private scene?: THREE.Scene;
  private camera?: THREE.OrthographicCamera;
  private renderer?: THREE.WebGLRenderer;
  private controls?: OrbitControls;
  private entityMeshes = new Map<string, THREE.Object3D>();
  private gridHelper?: THREE.GridHelper;

  // Inputs
  public projectId = input<string | null>(null);
  public geoJsonPath = input<string | null>(null);

  // Outputs
  public slabSelected = output<Shape>();

  // THREE.js Raycaster for selection
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  constructor() {
    // Re-render when document changes
    effect(() => {
      const doc = this.store.document();
      if (doc) {
        this.renderDxf(doc.data);
      }
    });

    // Highlight effect for selected entity
    effect(() => {
      const selected = this.store.selectedEntity();
      this.updateEntityHighlight(selected);
    });

    // Grid visibility effect
    effect(() => {
      const showGrid = this.store.showGrid();
      if (this.gridHelper) {
        this.gridHelper.visible = showGrid;
      }
    });
  }

  public ngAfterViewInit(): void {
    this.initThreeJs();
  }

  /**
   * Update entity highlight based on selection
   */
  private updateEntityHighlight(selected: SelectedEntity | null): void {
    // Reset all colors
    this.entityMeshes.forEach((mesh) => {
      if (mesh instanceof THREE.Line || mesh instanceof THREE.LineLoop) {
        (mesh.material as THREE.LineBasicMaterial).color.setHex(0x00ff00);
        (mesh.material as THREE.LineBasicMaterial).linewidth = 1;
      }
    });

    if (selected) {
      const mesh = this.entityMeshes.get(selected.id);
      if (
        mesh &&
        (mesh instanceof THREE.Line || mesh instanceof THREE.LineLoop)
      ) {
        (mesh.material as THREE.LineBasicMaterial).color.setHex(0xff0000);
        (mesh.material as THREE.LineBasicMaterial).linewidth = 3;
      }
    }
  }

  private initThreeJs(): void {
    const container = this.canvasContainer()?.nativeElement;
    if (!container) return;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a1a);

    // Camera
    const aspect = container.clientWidth / container.clientHeight;
    const frustumSize = 100;
    this.camera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000,
    );
    this.camera.position.set(0, 0, 100);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableRotate = false;
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };

    // Click listener for Raycasting
    this.renderer.domElement.addEventListener('click', (event) =>
      this.onCanvasClick(event),
    );

    // Grid setup
    this.gridHelper = new THREE.GridHelper(200, 20, 0x404040, 0x2d2d2d);
    this.gridHelper.rotation.x = Math.PI / 2;
    this.scene.add(this.gridHelper);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const animate = (): void => {
      requestAnimationFrame(animate);
      this.controls?.update();
      this.renderer?.render(this.scene!, this.camera!);
    };
    animate();

    window.addEventListener('resize', () => this.onResize());
  }

  private onCanvasClick(event: MouseEvent): void {
    if (!this.store.isSelectionMode() || !this.camera || !this.scene) return;

    const container = this.canvasContainer()?.nativeElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    this.mouse.x =
      ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
    this.mouse.y =
      -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersects = this.raycaster.intersectObjects(this.scene.children);

    if (intersects.length > 0) {
      const firstHit = intersects.find((hit) => hit.object !== this.gridHelper);

      if (firstHit) {
        let foundId = '';
        this.entityMeshes.forEach((mesh, id) => {
          if (mesh === firstHit.object) foundId = id;
        });

        if (foundId) {
          const geometry = (firstHit.object as THREE.Mesh)
            .geometry as THREE.BufferGeometry;
          const positions = geometry.getAttribute('position');
          const points: Array<{ x: number; y: number }> = [];

          for (let i = 0; i < positions.count; i++) {
            points.push({
              x: positions.getX(i),
              y: positions.getY(i),
            });
          }

          this.store.setSelectedEntity({
            id: foundId,
            userData: firstHit.object.userData as Record<string, unknown>,
            points,
          });
          return;
        }
      }
    }

    // Deselect if no hit
    this.store.setSelectedEntity(null);
  }

  protected useSelectedAsSlab(): void {
    const selected = this.store.selectedEntity();
    if (!selected || !selected.points.length) return;

    const shape: Shape = {
      id: crypto.randomUUID(),
      type: 'polygon',
      x: 0,
      y: 0,
      points: selected.points,
      layer: 'slab',
      properties: {
        fill: '#eeeeee',
        stroke: '#000000',
        opacity: 0.5,
      },
    };

    this.slabSelected.emit(shape);
  }

  protected toggleSelectionMode(): void {
    this.store.toggleSelectionMode();
  }

  private onResize(): void {
    const container = this.canvasContainer()?.nativeElement;
    if (!container || !this.camera || !this.renderer) return;

    const aspect = container.clientWidth / container.clientHeight;
    const frustumSize = 100;

    this.camera.left = (frustumSize * aspect) / -2;
    this.camera.right = (frustumSize * aspect) / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = frustumSize / -2;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(container.clientWidth, container.clientHeight);
  }

  private renderDxf(data: DxfData): void {
    if (!this.scene) return;

    // Clear previous entities
    this.entityMeshes.forEach((mesh) => this.scene!.remove(mesh));
    this.entityMeshes.clear();

    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });

    for (const entity of data.entities) {
      let mesh: THREE.Object3D | null = null;

      switch (entity.type) {
        case 'LINE':
          if (entity.startPoint && entity.endPoint) {
            const geometry = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(entity.startPoint.x, entity.startPoint.y, 0),
              new THREE.Vector3(entity.endPoint.x, entity.endPoint.y, 0),
            ]);
            mesh = new THREE.Line(geometry, lineMaterial);
          }
          break;

        case 'POLYLINE':
          if (entity.vertices) {
            const points = entity.vertices.map(
              (v) => new THREE.Vector3(v.x, v.y, 0),
            );
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            mesh = new THREE.Line(geometry, lineMaterial);
          }
          break;

        case 'CIRCLE':
          if (entity.center && entity.radius) {
            const geometry = new THREE.CircleGeometry(entity.radius, 32);
            const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
            mesh = new THREE.LineLoop(geometry, material);
            mesh.position.set(entity.center.x, entity.center.y, 0);
          }
          break;

        case 'ARC':
          if (entity.center && entity.radius) {
            const geometry = new THREE.CircleGeometry(entity.radius, 32);
            const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
            mesh = new THREE.LineLoop(geometry, material);
            mesh.position.set(entity.center.x, entity.center.y, 0);
          }
          break;

        case 'TEXT':
          // Skip text rendering for now
          break;
      }

      if (mesh) {
        mesh.userData = { layer: entity.layer };
        this.scene.add(mesh);
        this.entityMeshes.set(
          `${entity.layer}-${this.entityMeshes.size}`,
          mesh,
        );
      }
    }

    this.fitToView();
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.store.uploadFile(file);
    input.value = '';
  }

  protected isLayerVisible(layer: string): boolean {
    return this.store.isLayerVisible(layer);
  }

  protected toggleLayer(layer: string): void {
    this.store.toggleLayer(layer);

    // Update mesh visibility
    const visible = this.store.visibleLayers();
    this.entityMeshes.forEach((mesh) => {
      if (mesh.userData['layer'] === layer) {
        mesh.visible = visible.has(layer);
      }
    });
  }

  protected resetCamera(): void {
    if (!this.camera || !this.controls) return;

    this.camera.position.set(0, 0, 100);
    this.camera.zoom = 1;
    this.camera.updateProjectionMatrix();
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  protected fitToView(): void {
    const bounds = this.store.bounds();
    if (!bounds || !this.camera) return;

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    const container = this.canvasContainer()?.nativeElement;
    if (!container) return;

    const wValid = width > 0.001 ? width : 100;
    const hValid = height > 0.001 ? height : 100;

    const zoom = Math.min(
      (container.clientWidth / wValid) * 0.8,
      (container.clientHeight / hValid) * 0.8,
    );

    this.camera.zoom = zoom;
    this.camera.updateProjectionMatrix();

    if (this.controls) {
      this.controls.target.set(centerX, centerY, 0);
      this.controls.update();
    }
  }

  protected toggleGrid(): void {
    this.store.toggleGrid();
  }

  protected clearDocument(): void {
    this.store.clearDocument();
    this.entityMeshes.forEach((mesh) => this.scene?.remove(mesh));
    this.entityMeshes.clear();
  }

  protected clearError(): void {
    this.store.clearError();
  }
}
