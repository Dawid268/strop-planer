import {
  Component,
  inject,
  signal,
  OnInit,
  viewChild,
  AfterViewInit,
} from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { MessageService } from "primeng/api";
import { ToastModule } from "primeng/toast";
import { ProjectsService } from "../projects/services/projects.service";
import { EditorStore } from "./store/editor.store";
import { EditorToolbarComponent } from "./components/editor-toolbar.component";
import { EditorCanvasComponent } from "./components/editor-canvas.component";
import { EditorSidebarComponent } from "./components/editor-sidebar.component";
import { FloorPlanDxfViewerComponent } from "../floor-plan/components/floor-plan-dxf-viewer/floor-plan-dxf-viewer.component";
import { CommonModule } from "@angular/common";
import { ButtonModule } from "primeng/button";

@Component({
  selector: "app-editor-page",
  standalone: true,
  imports: [
    CommonModule,
    EditorToolbarComponent,
    EditorCanvasComponent,
    EditorSidebarComponent,
    FloorPlanDxfViewerComponent,
    ButtonModule,
    ToastModule,
  ],
  providers: [MessageService, EditorStore],
  template: `
    <div class="editor-layout flex flex-column h-screen overflow-hidden">
      <app-editor-toolbar
        (save)="onSave()"
        (rotateCanvasLeft)="onRotateCanvasLeft()"
        (rotateCanvasRight)="onRotateCanvasRight()"
      >
        <p-button
          [label]="showDxf() ? 'Wróć do Edytora' : 'Import Podkładu'"
          [icon]="showDxf() ? 'pi pi-arrow-left' : 'pi pi-file-import'"
          [severity]="showDxf() ? 'warn' : 'primary'"
          [outlined]="true"
          (click)="toggleView()"
        ></p-button>
      </app-editor-toolbar>

      <div class="flex-grow-1 relative overflow-hidden bg-50">
        @if (showDxf()) {
          <app-floor-plan-dxf-viewer
            class="dxf-viewer-full w-full h-full block"
            [geoJsonPath]="geoJsonPath() || ''"
            (slabSelected)="onSlabSelected($event)"
          ></app-floor-plan-dxf-viewer>
        }

        <!-- Editor Canvas -->
        <div
          class="editor-container w-full h-full relative"
          [class.hidden]="showDxf()"
        >
          <app-editor-canvas #editorCanvas></app-editor-canvas>
          <app-editor-sidebar
            class="properties-panel shadow-2"
          ></app-editor-sidebar>
        </div>
      </div>
    </div>
    <p-toast></p-toast>
  `,
  styles: [
    `
      .properties-panel {
        width: 320px;
        background: white;
        position: absolute;
        right: 0;
        top: 0;
        bottom: 0;
        z-index: 10;
        overflow-y: auto;
      }

      .hidden {
        display: none !important;
      }
    `,
  ],
})
export class EditorPageComponent implements OnInit, AfterViewInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private projectsService = inject(ProjectsService);
  private store = inject(EditorStore);
  private messageService = inject(MessageService);

  private editorCanvas = viewChild<EditorCanvasComponent>("editorCanvas");

  protected showDxf = signal(false);
  protected projectId = signal<string | null>(null);
  protected geoJsonPath = signal<string | null>(null);
  protected svgUrlToLoad = signal<string | null>(null);
  private geometryToLoad = signal<any | null>(null);

  toggleView() {
    this.showDxf.update((v) => !v);
  }

  ngAfterViewInit(): void {
    // Load SVG after view is ready if URL is set
    const svgUrl = this.svgUrlToLoad();
    if (svgUrl) {
      setTimeout(() => this.loadSvgToCanvas(svgUrl), 100);
    }

    // Load Geometry after view is ready if set
    const geom = this.geometryToLoad();
    if (geom) {
      setTimeout(() => {
        const canvas = this.editorCanvas();
        if (canvas) canvas.loadPolygonsFromGeometry(geom);
      }, 150);
    }
  }

  private loadSvgToCanvas(svgUrl: string): void {
    const canvas = this.editorCanvas();
    if (canvas) {
      canvas.loadSvgFromUrl(svgUrl).then(() => {
        this.messageService.add({
          severity: "success",
          summary: "Sukces",
          detail: "Załadowano wektory do edytora",
        });
      });
    } else {
      console.warn("Canvas not ready, deferring SVG load");
      this.svgUrlToLoad.set(svgUrl);
    }
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get("id");
    this.projectId.set(id);

    // Check for geometry passed via router state (from new project dialog)
    const navigationState =
      this.router.getCurrentNavigation()?.extras?.state || history.state;
    const stateGeometry = navigationState?.extractedGeometry;

    if (stateGeometry) {
      console.log("DEBUG: Loading geometry from router state", stateGeometry);
      this.loadGeometryData(stateGeometry);
      return;
    }

    if (id) {
      this.projectsService.getOne(id).subscribe({
        next: (project) => {
          console.log("DEBUG: EditorPageComponent loaded project", project.id);

          if (project.geoJsonPath) {
            this.geoJsonPath.set(project.geoJsonPath);
          }

          let autoTracedShapes: any[] = [];
          if (project.extractedSlabGeometry) {
            try {
              const geom =
                typeof project.extractedSlabGeometry === "string"
                  ? JSON.parse(project.extractedSlabGeometry)
                  : project.extractedSlabGeometry;

              if (geom && geom.polygons) {
                console.log(
                  "DEBUG: Found geometry with",
                  geom.polygons.length,
                  "segments - using segment loader for precise selection",
                );
                // Use polygon loader for precise selection
                const canvas = this.editorCanvas();
                if (canvas) {
                  canvas.loadPolygonsFromGeometry(geom);
                  this.messageService.add({
                    severity: "success",
                    summary: "Sukces",
                    detail: `Załadowano ${geom.polygons.length} linii`,
                  });
                } else {
                  console.warn("Canvas not ready for geometry, deferring");
                  this.geometryToLoad.set(geom);
                }
                // Skip SVG loading since we used segment loader
                return;
              }
            } catch (e) {
              console.error("Failed to parse extractedSlabGeometry", e);
            }
          }

          // Load SVG for proper rendering
          const svgPath = (project as any).svgPath;
          if (svgPath) {
            const fullSvgUrl = svgPath.startsWith("http")
              ? svgPath
              : `http://localhost:3000${svgPath}`;

            console.log("DEBUG: Will load SVG from URL:", fullSvgUrl);

            const canvas = this.editorCanvas();
            if (canvas) {
              this.loadSvgToCanvas(fullSvgUrl);
            } else {
              this.svgUrlToLoad.set(fullSvgUrl);
            }
          }
        },
        error: (err) => {
          console.error("Failed to load project", err);
          this.messageService.add({
            severity: "warn",
            summary: "Uwaga",
            detail: "Nie udało się załadować projektu z serwera",
          });
        },
      });
    }
  }

  private loadGeometryData(geometryData: any) {
    console.log("DEBUG: loadGeometryData called with", geometryData);

    let shapes: any[] = [];

    if (geometryData?.polygons) {
      shapes = geometryData.polygons.map((poly: any[], i: number) => ({
        id: `auto-slab-${i}`,
        type: "polygon",
        x: 0,
        y: 0,
        points: Array.isArray(poly)
          ? poly.map((p) => ({ x: p.x, y: p.y }))
          : [],
        layer: "slab",
        properties: { isAutoTraced: true },
      }));
    } else if (Array.isArray(geometryData)) {
      // If it's already an array of shapes
      shapes = geometryData;
    }

    console.log("DEBUG: Converted to shapes", shapes);
    this.store.loadFromProject(shapes, null);
  }

  onSlabSelected(shape: any) {
    this.store.addShape(shape);
    this.toggleView();
    this.messageService.add({
      severity: "info",
      summary: "Import",
      detail: "Zaimportowano obrys stropu",
    });
  }

  onSave() {
    const projectId = this.route.snapshot.paramMap.get("id");
    if (!projectId) return;

    const shapes = this.store.shapes();

    this.projectsService
      .update(projectId, {
        optimizationResult: { shapes },
      })
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: "success",
            summary: "Sukces",
            detail: "Projekt zapisany",
          });
        },
        error: (err) => {
          console.error("Failed to save project", err);
          this.messageService.add({
            severity: "error",
            summary: "Błąd",
            detail: "Błąd zapisu projektu",
          });
        },
      });
  }

  onRotateCanvasLeft(): void {
    const canvas = this.editorCanvas();
    if (canvas) {
      canvas.rotateCanvasLeft();
    }
  }

  onRotateCanvasRight(): void {
    const canvas = this.editorCanvas();
    if (canvas) {
      canvas.rotateCanvasRight();
    }
  }
}
