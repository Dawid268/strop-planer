import {
  Component,
  inject,
  signal,
  OnInit,
  viewChild,
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { MessageService } from "primeng/api";
import { ToastModule } from "primeng/toast";
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
  protected readonly store = inject(EditorStore);
  private readonly messageService = inject(MessageService);
  protected readonly cdr = inject(ChangeDetectorRef);

  private editorCanvas = viewChild<EditorCanvasComponent>("editorCanvas");

  protected showDxf = signal(false);
  protected projectId = signal<string | null>(null);
  protected geoJsonPath = signal<string | null>(null);
  protected svgUrlToLoad = signal<string | null>(null);

  toggleView() {
    this.showDxf.update((v) => !v);
  }

  ngAfterViewInit(): void {
    // Canvas now handles loading background and reference geometry via effects on the store
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
      this.store.loadEditorData(id);
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
