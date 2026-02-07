import {
  Component,
  ElementRef,
  OnInit,
  OnDestroy,
  inject,
  viewChild,
  effect,
  AfterViewInit,
  HostListener,
  ChangeDetectionStrategy,
  NgZone,
  signal,
  untracked,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { fabric } from "fabric";
import { EditorStore } from "@stores/editor";
import { CadService } from "@core/services/cad.service";
import { FabricRendererService } from "@core/services/fabric-renderer.service";
import { CustomFabricObject, rotatePoint } from "@utils/canvas.utils";
import { CanvasDrawingService } from "@services/canvas-drawing.service";
import { CanvasInteractionService } from "@services/canvas-interaction.service";
import { CanvasSelectionService } from "@services/canvas-selection.service";
import { CanvasStateService } from "@services/canvas-state.service";
import { CanvasHistoryService } from "@services/canvas-history.service";
import { CanvasKeyboardService } from "@services/canvas-keyboard.service";
import { CanvasClipboardService } from "@services/canvas-clipboard.service";
import { CanvasSlabDetectionService } from "@services/canvas-slab-detection.service";
import { ViewportService } from "@services/viewport.service";
import { CanvasEventHandlerService } from "@services/canvas-event-handler.service";
import { CanvasShapeSyncService } from "@services/canvas-shape-sync.service";
import type { RawGeometry } from "@models/geometry.models";
import {
  ContextToolbarComponent,
  CanvasEmptyStateComponent,
  CanvasLoadingOverlayComponent,
} from "./components";

@Component({
  selector: "app-editor-canvas",
  standalone: true,
  imports: [
    CommonModule,
    ContextToolbarComponent,
    CanvasEmptyStateComponent,
    CanvasLoadingOverlayComponent,
  ],
  providers: [
    CanvasDrawingService,
    CanvasInteractionService,
    CanvasSelectionService,
    CanvasStateService,
    CanvasHistoryService,
    CanvasKeyboardService,
    CanvasClipboardService,
    CanvasSlabDetectionService,
    ViewportService,
    CanvasEventHandlerService,
    CanvasShapeSyncService,
  ],
  templateUrl: "./editor-canvas.component.html",
  styleUrls: ["./editor-canvas.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorCanvasComponent implements OnInit, AfterViewInit, OnDestroy {
  // Store and orchestration
  protected readonly store = inject(EditorStore);
  private readonly ngZone = inject(NgZone);
  private readonly eventHandler = inject(CanvasEventHandlerService);
  private readonly shapeSync = inject(CanvasShapeSyncService);

  // Canvas services (delegated operations)
  protected readonly drawing = inject(CanvasDrawingService);
  protected readonly interaction = inject(CanvasInteractionService);
  protected readonly state = inject(CanvasStateService);
  protected readonly history = inject(CanvasHistoryService);
  private readonly keyboard = inject(CanvasKeyboardService);
  private readonly clipboardService = inject(CanvasClipboardService);
  private readonly slabDetection = inject(CanvasSlabDetectionService);
  protected readonly viewport = inject(ViewportService);
  protected readonly cadService = inject(CadService);
  protected readonly fabricRenderer = inject(FabricRendererService);

  protected readonly forceUpdate = signal(0);
  private readonly containerRef =
    viewChild<ElementRef<HTMLDivElement>>("container");
  private readonly canvasRef =
    viewChild<ElementRef<HTMLCanvasElement>>("fabricCanvas");

  private canvas: fabric.Canvas | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private gridLines: fabric.Line[] = [];
  private canvasInitialized = false;
  private hasAutoFitted = false;

  constructor() {
    // Simplified effects: removed zoom/pan effects
    // ViewportService now handles atomic rendering via onViewChange

    effect(() => {
      const bgUrl = this.store.backgroundUrl();
      if (this.canvas && this.canvasInitialized) {
        // Use untracked to avoid re-triggering during zoom/pan
        untracked(() => {
          if (bgUrl) {
            this.state.loadSvgFromUrl(this.canvas!, bgUrl);
          } else {
            this.state.clearBackground(this.canvas!);
          }
        });
      }
    });

    effect(() => {
      if (this.canvasInitialized) {
        this.updateGridVisible(this.store.showGrid());
      }
    });
    effect(() => {
      if (this.canvasInitialized) {
        this.updateToolMode(this.store.activeTool());
      }
    });
    effect(() => {
      if (this.canvasInitialized) {
        this.updateViewMode(this.store.viewMode());
      }
    });

    effect(() => {
      // Access signals we care about to trigger sync
      this.store.tabShapesWithMetadata(); // Trigger on any shape source change
      this.store.activeTabId();

      // Specifically ignore zoom/pan updates for shape syncing
      if (this.canvas && this.canvasInitialized) {
        untracked(() => {
          this.syncShapesWithCanvas();
        });
      }
    });

    effect(() => {
      this.store.activeTabId(); // Re-run when switching tabs
      const cadData = this.cadService.cadData();
      const cadLayer = this.store.cadLayer();
      if (!this.canvasInitialized) return;
      untracked(() => {
        if (cadLayer && cadData) {
          this.fabricRenderer.renderCadData(cadData, {
            visible: cadLayer.isVisible,
            opacity: cadLayer.opacity,
            locked: cadLayer.isLocked,
          });
        } else {
          this.fabricRenderer.clearCadObjects();
        }
      });
    });

    effect(() => {
      const cadLayer = this.store.cadLayer();
      if (cadLayer && this.canvasInitialized) {
        untracked(() => {
          this.fabricRenderer.batchUpdateCadObjects({
            visible: cadLayer.isVisible,
            opacity: cadLayer.opacity,
            locked: cadLayer.isLocked,
          });
        });
      }
    });

    effect(() => {
      const projectId = this.store.projectId();
      if (projectId) {
        this.cadService.loadCadData(projectId);
      }
    });
  }

  // Intentionally empty - initialization handled in ngAfterViewInit
  // eslint-disable-next-line @angular-eslint/no-empty-lifecycle-method
  public ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      this.initCanvas();
      this.setupResizeObserver();
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.eventHandler.destroy();
    this.shapeSync.reset();
    this.interaction.reset();
    this.fabricRenderer.destroy();
    this.canvas?.dispose();
  }

  private initCanvas(): void {
    const canvasEl = this.canvasRef()?.nativeElement;
    const containerEl = this.containerRef()?.nativeElement;
    if (!canvasEl || !containerEl) return;

    // Initialize canvas via fabricRenderer (single source of truth)
    this.fabricRenderer.init(canvasEl);
    this.canvas = this.fabricRenderer.getCanvas();

    if (!this.canvas) return;

    // PERFORMANCE: These flags are already set in FabricRenderer.init,
    // but we ensure extra settings here if needed by the editor specifically.
    // FABRIC.JS API: Disable native per-pixel hit detection for better performance
    // with thousands of objects. Our custom select tool logic in mouse:down
    // handles precise line selection more efficiently using analytical geometry.
    this.canvas.perPixelTargetFind = false;
    this.canvas.targetFindTolerance = 0;

    // PERFORMANCE: Ensure background objects aren't unnecessary cached or checked
    this.canvas.skipOffscreen = true;
    this.canvas.preserveObjectStacking = true; // Required for CAD layering order

    // CSS: optimal rendering
    canvasEl.style.imageRendering = "auto";

    // Middle click and context menu
    this.canvas.fireMiddleClick = true;
    this.canvas.stopContextMenu = true;

    this.viewport.setViewportSize(
      containerEl.clientWidth,
      containerEl.clientHeight,
    );

    this.eventHandler.init(this.canvas, containerEl, {
      getActiveTool: () => this.store.activeTool(),
      getActiveLayer: () => this.store.activeLayer(),
      onSelectionChanged: (ids: string[]) => this.store.selectMultiple(ids),
      onShapeModified: (
        id: string,
        changes: { x: number; y: number; rotation: number },
      ) => {
        this.store.updateShape(id, changes);
      },
      onClearSelection: () => this.store.clearSelection(),
      findNearestSnapPoint: (
        point: { x: number; y: number },
        threshold: number,
      ) => {
        return this.store.findNearestSnapPoint(point, threshold);
      },
      setZoom: (zoom: number) => this.store.setZoom(zoom),
      setPan: (x: number, y: number) => this.store.setPan(x, y),
      saveHistoryState: () => this.history.saveState(this.canvas),
      onAutoSlabTrigger: (pointer: { x: number; y: number }) => {
        this.autoDetectSlab(pointer);
      },
    });

    this.canvasInitialized = true;
    this.updateGridVisible(this.store.showGrid());

    setTimeout(() => {
      this.syncShapesWithCanvas();
    }, 100);
  }

  private updateToolMode(tool: string): void {
    if (!this.canvas) return;
    this.drawing.clearDrawingPreviews(this.canvas);
    this.canvas.selection = tool === "select";
    this.canvas.defaultCursor =
      tool === "pan" ? "grab" : tool.includes("draw") ? "crosshair" : "default";
    this.canvas.requestRenderAll();
  }

  private updateGridVisible(show: boolean): void {
    if (!this.canvas) return;

    // Clear old line-based grid if any
    this.gridLines.forEach((l) => this.canvas!.remove(l));
    this.gridLines = [];

    if (!show) {
      this.canvas.setBackgroundColor("#1e1e1e", () => {
        this.canvas?.requestRenderAll();
      });
      return;
    }

    const gridSize = this.store.gridSize();
    const subGridColor = "rgba(255, 255, 255, 0.05)";

    // Create a tiny grid pattern canvas
    const patternCanvas = document.createElement("canvas");
    patternCanvas.width = gridSize;
    patternCanvas.height = gridSize;
    const ctx = patternCanvas.getContext("2d");
    if (ctx) {
      ctx.strokeStyle = subGridColor;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(gridSize, 0);
      ctx.moveTo(0, 0);
      ctx.lineTo(0, gridSize);
      ctx.stroke();
    }

    const pattern = new fabric.Pattern({
      source: patternCanvas,
      repeat: "repeat",
    });

    this.canvas.setBackgroundColor(pattern, () => {
      this.canvas?.requestRenderAll();
    });
  }

  private updateViewMode(mode: "full" | "slab"): void {
    this.canvas?.getObjects().forEach((obj) => {
      if ((obj as CustomFabricObject).customData?.isFromSvg)
        obj.visible = mode === "full";
    });
    this.canvas?.requestRenderAll();
  }

  private setupResizeObserver(): void {
    const el = this.containerRef()?.nativeElement;
    if (!el) return;
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const height = entry.contentRect.height;
        this.canvas?.setDimensions({ width, height });
        this.viewport.setViewportSize(width, height);
        this.canvas?.requestRenderAll();
      }
    });
    this.resizeObserver.observe(el);
  }

  @HostListener("document:keydown", ["$event"])
  public onKeyDown(e: KeyboardEvent): void {
    this.keyboard.handleKeyDown(e, this.canvas, {
      deleteSelected: () => this.deleteSelected(),
      rotateSelected: () => this.rotateSelected(),
      selectAll: () => this.selectAll(),
    });
  }

  public generateFormworkForSelected(): void {
    const active = this.canvas?.getActiveObject() as CustomFabricObject;
    if (active?.customData?.id) {
      if (this.store.viewMode() === "full") {
        this.store.generateAutoLayout(active.customData.id);
      } else {
        this.store.generateOptimalLayout(active.customData.id);
      }
    }
  }

  public deleteSelected(): void {
    this.canvas?.getActiveObjects().forEach((o: fabric.Object) => {
      const id = (o as CustomFabricObject).customData?.id;
      if (id) {
        this.store.removeShape(id);
      }
      this.canvas!.remove(o);
    });
    this.canvas?.discardActiveObject();
    this.state.updateObjectCount(this.canvas);
    this.history.saveState(this.canvas);
  }

  /** Automatic slab detection starting from a clicked point (delegated to service) */
  public autoDetectSlab(pointer: { x: number; y: number }): void {
    if (this.canvas) {
      this.slabDetection.autoDetectSlab(this.canvas, pointer);
    }
  }

  /** Convert selected CAD segments into a slab polygon (delegated to service) */
  public convertSelectedToSlab(): void {
    if (this.canvas) {
      this.slabDetection.convertSelectedToSlab(this.canvas);
    }
  }

  public rotateSelected(): void {
    const active = this.canvas?.getActiveObject();
    if (active) {
      active.rotate((active.angle || 0) + 90);
      this.canvas!.requestRenderAll();
    }
  }

  public copySelected(): void {
    if (this.canvas) this.clipboardService.copy(this.canvas);
  }

  public pasteSelected(): void {
    if (this.canvas) this.clipboardService.paste(this.canvas);
  }

  public lockSelected(): void {
    this.canvas
      ?.getActiveObjects()
      .forEach((o: fabric.Object) =>
        o.set({ selectable: false, evented: false }),
      );
    this.canvas?.discardActiveObject();
  }

  public selectAll(): void {
    const objs = this.canvas!.getObjects().filter(
      (o: fabric.Object) =>
        !(o as CustomFabricObject).customData?.isGrid && o.selectable,
    );
    if (objs.length)
      this.canvas!.setActiveObject(
        new fabric.ActiveSelection(objs, { canvas: this.canvas! }),
      );
    this.canvas!.requestRenderAll();
  }

  public rotateCanvas(deg: number): void {
    if (!this.canvas) return;
    const center = { x: this.canvas.width! / 2, y: this.canvas.height! / 2 };
    this.canvas
      .getObjects()
      .filter(
        (o: fabric.Object) => !(o as CustomFabricObject).customData?.isGrid,
      )
      .forEach((o: fabric.Object) => {
        const pt = rotatePoint(o.getCenterPoint(), center, deg);
        o.set({ left: pt.x, top: pt.y, angle: (o.angle || 0) + deg });
        o.setCoords();
      });
    this.canvas.requestRenderAll();
  }

  public rotateCanvasLeft(): void {
    this.rotateCanvas(-90);
  }

  public rotateCanvasRight(): void {
    this.rotateCanvas(90);
  }

  public async loadSvgFromUrl(url: string): Promise<void> {
    return this.state.loadSvgFromUrl(this.canvas, url);
  }

  public loadPolygonsFromGeometry(geom: RawGeometry | null): void {
    this.state.loadPolygonsFromGeometry(this.canvas, geom);
  }

  public syncShapesWithCanvas(): void {
    if (!this.canvas) return;

    const shapesMetadata = this.store.tabShapesWithMetadata();
    this.shapeSync.syncShapes(this.canvas, shapesMetadata);
    this.state.updateObjectCount(this.canvas);

    const hasObjects = this.canvas
      .getObjects()
      .some(
        (o: fabric.Object) => !(o as CustomFabricObject).customData?.isGrid,
      );
    if (!this.hasAutoFitted && hasObjects) {
      this.hasAutoFitted = true;
      const cadData = this.cadService.cadData();
      if (cadData) {
        this.fabricRenderer.zoomToFit(cadData.bounds);
      } else {
        setTimeout(() => this.zoomToContent(), 100);
      }
    }
  }

  private zoomToContent(): void {
    if (!this.canvas) return;

    const objects = this.canvas
      .getObjects()
      .filter(
        (o: fabric.Object) => !(o as CustomFabricObject).customData?.isGrid,
      );

    if (objects.length === 0) return;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    objects.forEach((obj: fabric.Object) => {
      const bounds = obj.getBoundingRect();
      minX = Math.min(minX, bounds.left);
      minY = Math.min(minY, bounds.top);
      maxX = Math.max(maxX, bounds.left + bounds.width);
      maxY = Math.max(maxY, bounds.top + bounds.height);
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const canvasWidth = this.canvas.getWidth();
    const canvasHeight = this.canvas.getHeight();

    const padding = 50;
    const scaleX = (canvasWidth - padding * 2) / contentWidth;
    const scaleY = (canvasHeight - padding * 2) / contentHeight;
    const scale = Math.min(scaleX, scaleY, 1);

    const centerX = minX + contentWidth / 2;
    const centerY = minY + contentHeight / 2;

    const vpt = this.canvas.viewportTransform;
    if (vpt) {
      vpt[0] = scale;
      vpt[3] = scale;
      vpt[4] = canvasWidth / 2 - centerX * scale;
      vpt[5] = canvasHeight / 2 - centerY * scale;
      this.canvas.setViewportTransform(vpt);
    }

    this.store.setZoom(scale);
    this.canvas.requestRenderAll();
  }
}
