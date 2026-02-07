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
import { mergeSegmentsToPolygon, Segment } from "@utils/geometry-healing.utils";
import { CanvasDrawingService } from "@services/canvas-drawing.service";
import { CanvasInteractionService } from "@services/canvas-interaction.service";
import { CanvasSelectionService } from "@services/canvas-selection.service";
import { CanvasStateService } from "@services/canvas-state.service";
import { CanvasHistoryService } from "@services/canvas-history.service";
import { ViewportService } from "@services/viewport.service";
import { CanvasEventHandlerService } from "@services/canvas-event-handler.service";
import { CanvasShapeSyncService } from "@services/canvas-shape-sync.service";
import type { EditorTool } from "@models/editor.models";
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
  private clipboard: fabric.Object[] = [];
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
  onKeyDown(e: KeyboardEvent): void {
    if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName))
      return;
    const key = e.key.toLowerCase(),
      ctrl = e.ctrlKey || e.metaKey,
      shift = e.shiftKey;

    if (key === "delete" || key === "backspace") {
      e.preventDefault();
      this.deleteSelected();
    } else if (key === "escape") {
      this.drawing.clearDrawingPreviews(this.canvas!);
      this.canvas?.discardActiveObject();
      this.interaction.showContextToolbar.set(false);
      this.store.setActiveTool("select");
    } else if (key === "r" && !ctrl) {
      e.preventDefault();
      this.rotateSelected();
    } else if (key === "c" && ctrl) {
      e.preventDefault();
      this.copySelected();
    } else if (key === "v" && ctrl) {
      e.preventDefault();
      this.pasteSelected();
    } else if (key === "a" && ctrl) {
      e.preventDefault();
      this.selectAll();
    } else if (key === "z" && ctrl) {
      e.preventDefault();
      if (shift) {
        this.history.redo(this.canvas);
      } else {
        this.history.undo(this.canvas);
      }
    } else if (["v", "h", "b", "m", "p", "s"].includes(key) && !ctrl) {
      const tools: Record<string, EditorTool> = {
        v: "select",
        h: "pan",
        b: "draw-beam",
        m: "trace-slab",
        p: "draw-polygon",
        s: "add-prop",
      };
      this.store.setActiveTool(tools[key]);
    }
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

  /**
   * Automatic slab detection starting from a clicked point.
   */
  public autoDetectSlab(pointer: { x: number; y: number }): void {
    if (!this.canvas) return;

    // 1. Find the target line under the cursor
    const targets = this.interaction.findObjectsAtPoint(
      this.canvas,
      pointer,
    ) as CustomFabricObject[];
    const startObj = targets.find(
      (t) => t.customData?.type === "line" || t.type === "line",
    );

    if (!startObj) return;

    // 2. Collect ALL lines on the canvas to find connections
    const allObjects = this.canvas.getObjects() as CustomFabricObject[];
    const allLines: Segment[] = [];

    allObjects.forEach((obj) => {
      const data = obj.customData;
      if (data?.type === "line" && data.x1 !== undefined) {
        allLines.push({
          p1: { x: data.x1, y: data.y1! },
          p2: { x: data.x2!, y: data.y2! },
        });
      } else if (obj.type === "line") {
        const l = obj as fabric.Line;
        allLines.push({
          p1: { x: l.x1!, y: l.y1! },
          p2: { x: l.x2!, y: l.y2! },
        });
      }
    });

    // 3. Use healing utility to find the enclosing contour
    // For MVP, we use the simple merge logic starting from the clicked line
    // In a more advanced version, we would use a graph-based cycle detection.
    const points = mergeSegmentsToPolygon(allLines, 15);

    if (points.length >= 3) {
      this.store.createSlabFromPoints(points);
      this.canvas.requestRenderAll();
      this.history.saveState(this.canvas);
    }
  }

  /**
   * Converts selected CAD segments/lines into a single Slab polygon.
   * Triggered from Context Toolbar.
   */
  public convertSelectedToSlab(): void {
    if (!this.canvas) return;

    const selected = this.canvas.getActiveObjects() as CustomFabricObject[];
    if (selected.length === 0) return;

    const segments: Segment[] = [];
    const storeShapeIdsToRemove: string[] = [];

    selected.forEach((obj) => {
      const data = obj.customData;

      if (data?.type === "line" && data.x1 !== undefined) {
        segments.push({
          p1: { x: data.x1, y: data.y1! },
          p2: { x: data.x2!, y: data.y2! },
        });
      } else if (obj.type === "line") {
        const line = obj as fabric.Line;
        segments.push({
          p1: { x: line.x1!, y: line.y1! },
          p2: { x: line.x2!, y: line.y2! },
        });
      }

      if (data?.id && !data.isCadEntity) {
        storeShapeIdsToRemove.push(data.id);
      }
    });

    if (segments.length === 0) return;

    const points = mergeSegmentsToPolygon(segments, 10);
    if (points.length >= 3) {
      this.store.createSlabFromPoints(points);

      if (storeShapeIdsToRemove.length > 0) {
        this.store.removeShapes(storeShapeIdsToRemove);
      }

      // Cleanup
      selected.forEach((obj) => {
        if (!obj.data?.isCadEntity) {
          this.canvas!.remove(obj);
        }
      });
      this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
      this.history.saveState(this.canvas);
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
    this.clipboard = [];
    this.canvas
      ?.getActiveObjects()
      .forEach((o: fabric.Object) =>
        o.clone().then((c: fabric.Object) => this.clipboard.push(c)),
      );
  }

  public pasteSelected(): void {
    if (!this.canvas || this.clipboard.length === 0) return;
    this.clipboard.forEach((o: fabric.Object, i: number) =>
      o.clone().then((c: fabric.Object) => {
        c.set({ left: (c.left || 0) + 20, top: (c.top || 0) + 20 });
        (c as CustomFabricObject).customData = {
          id: `pasted-${Date.now()}-${i}`,
        };
        this.canvas!.add(c);
      }),
    );
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
