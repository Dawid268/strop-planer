import {
  Component,
  signal,
  computed,
  inject,
  viewChild,
  ElementRef,
  effect,
  AfterViewInit,
} from "@angular/core";
import { HttpClient, HttpEventType } from "@angular/common/http";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ToolbarModule } from "primeng/toolbar";
import { ButtonModule } from "primeng/button";
import { ProgressBarModule } from "primeng/progressbar";
import { CheckboxModule } from "primeng/checkbox";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { TooltipModule } from "primeng/tooltip";
import * as THREE from "three";
// @ts-ignore
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
// @ts-ignore
import * as ThreeDxf from "three-dxf";

interface DxfEntity {
  type: string;
  layer: string;
  vertices?: Array<{ x: number; y: number }>;
  center?: { x: number; y: number };
  radius?: number;
  startPoint?: { x: number; y: number };
  endPoint?: { x: number; y: number };
  text?: string;
}

interface DxfData {
  entities: DxfEntity[];
  layers: string[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

interface DocumentResponse {
  documentId: string;
  data: DxfData;
}
import { input, output } from "@angular/core";
import { Shape } from "../../../editor/models/editor.models";

@Component({
  selector: "app-floor-plan-dxf-viewer",
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
  template: `
    <div
      class="viewer-container flex flex-column h-full bg-900 text-0 font-sans overflow-hidden"
    >
      <p-toolbar
        styleClass="bg-800 border-none border-bottom-1 border-700 p-2 gap-3 flex-wrap"
      >
        <div class="p-toolbar-group-start gap-3">
          <div class="upload-section">
            <input
              type="file"
              accept=".pdf,.dxf"
              (change)="onFileSelected($event)"
              #fileInput
              id="file-upload"
              hidden
            />
            <p-button
              label="Wybierz PDF lub DXF"
              icon="pi pi-file-pdf"
              (click)="fileInput.click()"
              severity="primary"
            ></p-button>

            @if (uploadProgress() > 0 && uploadProgress() < 100) {
              <p-progressBar
                [value]="uploadProgress()"
                [showValue]="false"
                styleClass="w-10rem h-1rem mt-2"
              ></p-progressBar>
            }
          </div>

          @if (currentDocument()) {
            <div
              class="document-info flex align-items-center gap-3 bg-700 px-3 py-2 border-round font-mono text-sm"
            >
              <span>{{ currentDocument()!.documentId }}</span>
              <p-button
                icon="pi pi-times"
                [text]="true"
                severity="danger"
                (click)="clearDocument()"
                size="small"
              ></p-button>
            </div>

            <div
              class="layer-controls flex align-items-center gap-3 flex-wrap border-left-1 border-600 pl-3"
            >
              <span class="text-sm text-400">Warstwy:</span>
              @for (layer of layers(); track layer) {
                <div class="flex align-items-center gap-2">
                  <p-checkbox
                    [binary]="true"
                    [ngModel]="isLayerVisible(layer)"
                    (onChange)="toggleLayer(layer)"
                    [inputId]="'layer-' + layer"
                  ></p-checkbox>
                  <label
                    [for]="'layer-' + layer"
                    class="text-xs cursor-pointer select-none"
                    >{{ layer }}</label
                  >
                </div>
              }
            </div>
          }
        </div>

        <div class="p-toolbar-group-end gap-2">
          @if (currentDocument()) {
            <p-button
              [icon]="isSelectionMode() ? 'pi pi-mouse' : 'pi pi-cursor'"
              [severity]="isSelectionMode() ? 'primary' : 'secondary'"
              [outlined]="!isSelectionMode()"
              (click)="toggleSelectionMode()"
              pTooltip="Tryb wybierania (kliknij linię)"
              tooltipPosition="bottom"
              label="Wybierz"
            ></p-button>

            @if (selectedEntity()) {
              <p-button
                icon="pi pi-check"
                severity="success"
                (click)="useSelectedAsSlab()"
                label="Użyj jako obrys"
                pTooltip="Ustaw zaznaczony element jako strop"
                tooltipPosition="bottom"
              ></p-button>
            }

            <p-button
              icon="pi pi-target"
              (click)="resetCamera()"
              pTooltip="Reset widoku"
              tooltipPosition="bottom"
              [outlined]="true"
              severity="secondary"
            ></p-button>
            <p-button
              icon="pi pi-expand"
              (click)="fitToView()"
              pTooltip="Dopasuj do widoku"
              tooltipPosition="bottom"
              [outlined]="true"
              severity="secondary"
            ></p-button>
            <p-button
              [icon]="showGrid() ? 'pi pi-th-large' : 'pi pi-table'"
              (click)="toggleGrid()"
              pTooltip="Siatka"
              tooltipPosition="bottom"
              [outlined]="!showGrid()"
              [severity]="showGrid() ? 'primary' : 'secondary'"
            ></p-button>
          }
        </div>
      </p-toolbar>

      <main class="viewer-main flex-grow-1 relative overflow-hidden bg-900">
        @if (isLoading()) {
          <div
            class="loading absolute inset-0 z-10 flex flex-column align-items-center justify-content-center bg-black-alpha-70"
          >
            <p-progressSpinner
              styleClass="w-4rem h-4rem"
              strokeWidth="4"
            ></p-progressSpinner>
            <p class="mt-3 text-lg font-medium">Przetwarzanie pliku...</p>
          </div>
        }
        @if (error()) {
          <div
            class="error absolute inset-0 z-10 flex flex-column align-items-center justify-content-center bg-black-alpha-70 text-center p-4"
          >
            <i
              class="pi pi-exclamation-triangle text-6xl text-red-500 mb-4"
            ></i>
            <h3 class="m-0 text-2xl font-bold text-red-500">Błąd</h3>
            <p class="mt-2 text-lg">{{ error() }}</p>
            <p-button
              label="Spróbuj ponownie"
              (click)="error.set('')"
              class="mt-4"
              severity="secondary"
              [outlined]="true"
            ></p-button>
          </div>
        }

        <div #canvasContainer class="canvas-container w-full h-full"></div>

        @if (currentDocument()) {
          <div
            class="stats absolute bottom-0 left-0 m-3 p-3 bg-black-alpha-60 border-round shadow-2 flex gap-4 text-xs font-mono text-300"
          >
            <div class="flex align-items-center gap-2">
              <i class="pi pi-layers"></i>
              <span>Warstw: {{ layers().length }}</span>
            </div>
            <div class="flex align-items-center gap-2">
              <i class="pi pi-database"></i>
              <span>Elementów: {{ entityCount() }}</span>
            </div>
          </div>
        }
      </main>
    </div>
  `,
  styles: [
    `
      .viewer-container {
        font-family: var(--font-family);
      }
      .canvas-container {
        cursor: default;
      }
      ::ng-deep .p-toolbar {
        border-radius: 0;
      }
    `,
  ],
})
export class FloorPlanDxfViewerComponent implements AfterViewInit {
  private readonly http = inject(HttpClient);
  protected readonly canvasContainer = viewChild<ElementRef>("canvasContainer");

  protected readonly currentDocument = signal<DocumentResponse | null>(null);
  protected readonly uploadProgress = signal<number>(0);
  protected readonly isLoading = signal<boolean>(false);
  protected readonly error = signal<string>("");
  protected readonly visibleLayers = signal<Set<string>>(new Set());
  protected readonly showGrid = signal<boolean>(true);

  protected readonly layers = computed(() => {
    return this.currentDocument()?.data.layers ?? [];
  });

  protected readonly entityCount = computed(() => {
    return this.currentDocument()?.data.entities.length ?? 0;
  });

  private scene?: THREE.Scene;
  private camera?: THREE.OrthographicCamera;
  private renderer?: THREE.WebGLRenderer;
  private controls?: OrbitControls;
  private entityMeshes = new Map<string, THREE.Object3D>();
  private gridHelper?: THREE.GridHelper;

  public projectId = input<string | null>(null);
  public geoJsonPath = input<string | null>(null);

  public slabSelected = output<Shape>();

  protected readonly selectedEntity = signal<{
    id: string;
    userData: any;
    geometry: THREE.BufferGeometry;
  } | null>(null);
  protected readonly isSelectionMode = signal<boolean>(false);

  // THREE.js Raycaster
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  constructor() {
    effect(() => {
      // Auto-load if path is provided
      const path = this.geoJsonPath();
      if (path) {
        // TODO: implement loadDxfFromPath or remove this effect
        console.log("geoJsonPath changed to:", path);
      }
    });

    effect(() => {
      const doc = this.currentDocument();
      if (doc) {
        this.renderDxf(doc.data);
      }
    });

    // Highlight effect
    effect(() => {
      const selected = this.selectedEntity();
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
          (mesh.material as THREE.LineBasicMaterial).color.setHex(0xff0000); // Red highlight
          (mesh.material as THREE.LineBasicMaterial).linewidth = 3;
        }
      }
    });
  }

  // ... (loadDxfFromPath is unchanged)

  public ngAfterViewInit(): void {
    this.initThreeJs();
  }

  private initThreeJs(): void {
    const container = this.canvasContainer()?.nativeElement;
    if (!container) return;

    // ... (Scene setup unchanged)
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
    this.renderer.domElement.addEventListener("click", (event) =>
      this.onCanvasClick(event),
    );

    // ... (Grid, Lights, Animate unchanged)
    this.gridHelper = new THREE.GridHelper(200, 20, 0x404040, 0x2d2d2d);
    this.gridHelper.rotation.x = Math.PI / 2;
    this.scene.add(this.gridHelper);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    const animate = () => {
      requestAnimationFrame(animate);
      this.controls?.update();
      this.renderer?.render(this.scene!, this.camera!);
    };
    animate();

    window.addEventListener("resize", () => this.onResize());
  }

  private onCanvasClick(event: MouseEvent) {
    if (!this.isSelectionMode() || !this.camera || !this.scene) return;

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
        // Find ID
        let foundId = "";
        this.entityMeshes.forEach((mesh, id) => {
          if (mesh === firstHit.object) foundId = id;
        });

        if (foundId) {
          console.log("Selected:", foundId, firstHit.object.userData);
          this.selectedEntity.set({
            id: foundId,
            userData: firstHit.object.userData,
            geometry: (firstHit.object as any).geometry,
          });
          return;
        }
      }
    }

    // Deselect if no hit
    this.selectedEntity.set(null);
  }

  // ... (onResize, renderDxf unchanged, but verify loop logic)

  // New Method to use selection
  protected useSelectedAsSlab() {
    const selected = this.selectedEntity();
    if (!selected) return;

    const positions = selected.geometry.getAttribute("position");
    const points: { x: number; y: number }[] = [];

    for (let i = 0; i < positions.count; i++) {
      points.push({
        x: positions.getX(i),
        y: positions.getY(i),
      });
    }

    // Convert to Editor Shape
    // Scale? DXF is usually in mm or cm. Editor uses 1px = 1 unit.
    // Assuming 1:1 for now.

    // Create Polygon Shape
    // Editor needs unique ID
    const shape: Shape = {
      id: crypto.randomUUID(),
      type: "polygon",
      x: 0, // Points are absolute
      y: 0,
      points: points,
      layer: "slab",
      properties: {
        fill: "#eeeeee",
        stroke: "#000000",
        opacity: 0.5,
      },
    };

    this.slabSelected.emit(shape);
  }

  protected toggleSelectionMode() {
    this.isSelectionMode.update((v) => !v);
    // Disable pan on left click if selection mode is on?
    if (this.controls) {
      if (this.isSelectionMode()) {
        // Disable Pan on Left Click, maybe map keys?
        // Actually, Raycaster works even with Pan controls if click is short.
        // But dragging vs clicking is tricky.
        // OrbitControls handles drag. Click event fires after mouseup.
      }
    }
  }

  // ... (Keep existing methods: renderDxf, onFileSelected, isLayerVisible, toggleLayer, resetCamera, fitToView, toggleGrid, clearDocument)

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

    // Initialize visible layers
    this.visibleLayers.set(new Set(data.layers));

    const lineMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });

    for (const entity of data.entities) {
      let mesh: THREE.Object3D | null = null;

      switch (entity.type) {
        case "LINE":
          if (entity.startPoint && entity.endPoint) {
            const geometry = new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(entity.startPoint.x, entity.startPoint.y, 0),
              new THREE.Vector3(entity.endPoint.x, entity.endPoint.y, 0),
            ]);
            mesh = new THREE.Line(geometry, lineMaterial);
          }
          break;

        case "POLYLINE":
          if (entity.vertices) {
            const points = entity.vertices.map(
              (v) => new THREE.Vector3(v.x, v.y, 0),
            );
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            mesh = new THREE.Line(geometry, lineMaterial);
          }
          break;

        case "CIRCLE":
          if (entity.center && entity.radius) {
            const geometry = new THREE.CircleGeometry(entity.radius, 32);
            const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
            mesh = new THREE.LineLoop(geometry, material);
            mesh.position.set(entity.center.x, entity.center.y, 0);
          }
          break;

        case "ARC":
          // Simplified for now, just a circle or should we do arc?
          // Three.js EllipseCurve can do arcs.
          // CircleGeometry has thetaStart / length
          if (entity.center && entity.radius) {
            // Approximate arc
            const geometry = new THREE.CircleGeometry(entity.radius, 32);
            const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
            mesh = new THREE.LineLoop(geometry, material);
            mesh.position.set(entity.center.x, entity.center.y, 0);
          }
          break;

        case "TEXT":
          // Text is hard without FontLoader. Skip for MVP or use simple Sprites?
          // Skip for now.
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

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.isLoading.set(true);
    this.uploadProgress.set(0);
    this.error.set("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const result = await new Promise<DocumentResponse>((resolve, reject) => {
        this.http
          .post<DocumentResponse>(
            "http://localhost:3000/api/floor-plans-dxf/upload",
            formData,
            {
              reportProgress: true,
              observe: "events",
            },
          )
          .subscribe({
            next: (event) => {
              if (event.type === HttpEventType.UploadProgress && event.total) {
                this.uploadProgress.set(
                  Math.round((100 * event.loaded) / event.total),
                );
              } else if (event.type === HttpEventType.Response) {
                resolve(event.body!);
              }
            },
            error: reject,
          });
      });

      this.currentDocument.set(result);
      input.value = "";
    } catch (err: any) {
      console.error(err);
      this.error.set(err.error?.message || "Błąd przetwarzania pliku");
    } finally {
      this.isLoading.set(false);
      this.uploadProgress.set(0);
    }
  }

  protected isLayerVisible(layer: string): boolean {
    return this.visibleLayers().has(layer);
  }

  protected toggleLayer(layer: string): void {
    const visible = new Set(this.visibleLayers());

    if (visible.has(layer)) {
      visible.delete(layer);
    } else {
      visible.add(layer);
    }

    this.visibleLayers.set(visible);

    // Update mesh visibility
    this.entityMeshes.forEach((mesh) => {
      if (mesh.userData["layer"] === layer) {
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
    const data = this.currentDocument()?.data;
    if (!data || !this.camera) return;

    const { bounds } = data;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;

    const container = this.canvasContainer()?.nativeElement;
    if (!container) return;

    const aspect = container.clientWidth / container.clientHeight;
    // Safety check for width/height being 0
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
    this.showGrid.update((v) => !v);
    if (this.gridHelper) {
      this.gridHelper.visible = this.showGrid();
    }
  }

  protected clearDocument(): void {
    this.currentDocument.set(null);
    this.entityMeshes.forEach((mesh) => this.scene?.remove(mesh));
    this.entityMeshes.clear();
  }
}
