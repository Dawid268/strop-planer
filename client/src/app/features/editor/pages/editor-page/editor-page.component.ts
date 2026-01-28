import {
  Component,
  inject,
  signal,
  OnInit,
  viewChild,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, Router } from "@angular/router";
import { MessageService } from "primeng/api";
import { ToastModule } from "primeng/toast";
import { ProjectsService } from "@features/projects/services/projects.service";
import { EditorStore } from "../../store/editor.store";
import { EditorToolbarComponent } from "../../components/editor-toolbar";
import { EditorCanvasComponent } from "../../components/editor-canvas";
import { EditorSidebarComponent } from "../../components/editor-sidebar";
import { FloorPlanDxfViewerComponent } from "@features/floor-plan/components/floor-plan-dxf-viewer/floor-plan-dxf-viewer.component";
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
  templateUrl: "./editor-page.component.html",
  styleUrls: ["./editor-page.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorPageComponent implements OnInit, AfterViewInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectsService = inject(ProjectsService);
  protected readonly store = inject(EditorStore);
  private readonly messageService = inject(MessageService);
  protected readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

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
    const svgUrl = this.svgUrlToLoad();
    if (svgUrl) {
      setTimeout(() => this.loadSvgToCanvas(svgUrl), 100);
    }

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
    if (id) {
      this.store.setProjectId(id);
    }

    const exportId = this.route.snapshot.queryParamMap.get("exportId");
    if (exportId) {
      const data = sessionStorage.getItem(exportId);
      if (data) {
        try {
          const shapes = JSON.parse(data);
          this.store.loadFromProject(shapes, null);
          return;
        } catch (e) {
          console.error("Failed to parse export data", e);
        }
      }
    }

    if (id) {
      this.projectsService
        .getById(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (project: any) => {
            if (project.geoJsonPath) {
              this.geoJsonPath.set(project.geoJsonPath);
            }

            let savedShapes: any[] = [];
            if (project.optimizationResult) {
              try {
                const opt =
                  typeof project.optimizationResult === "string"
                    ? JSON.parse(project.optimizationResult)
                    : project.optimizationResult;
                if (opt && opt.shapes) {
                  savedShapes = opt.shapes;
                }
              } catch (e) {
                console.error("Failed to parse optimizationResult", e);
              }
            }

            const svgPath = (project as any).svgPath;
            let storeGeom = null;
            if (project.extractedSlabGeometry) {
              try {
                const geom =
                  typeof project.extractedSlabGeometry === "string"
                    ? JSON.parse(project.extractedSlabGeometry)
                    : project.extractedSlabGeometry;
                storeGeom = {
                  polygons: geom.polygons || geom.segments,
                  metadata: geom.metadata,
                };
              } catch (e) {
                console.error("Failed to parse extractedSlabGeometry", e);
              }
            }

            this.store.loadFromProject(savedShapes, svgPath, storeGeom);

            if (svgPath) {
              const fullSvgUrl = svgPath.startsWith("http")
                ? svgPath
                : `http://localhost:3000${svgPath}`;

              const canvas = this.editorCanvas();
              if (canvas) {
                this.loadSvgToCanvas(fullSvgUrl);
              } else {
                this.svgUrlToLoad.set(fullSvgUrl);
              }
            }
            this.cdr.detectChanges();
          },
          error: (err: any) => {
            console.error("Failed to load project", err);
            this.messageService.add({
              severity: "warn",
              summary: "Uwaga",
              detail: "Nie udało się załadować projektu z serwera",
            });
            this.cdr.detectChanges();
          },
        });
    }
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
    this.store.save();
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
