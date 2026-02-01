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
} from "@angular/core";
import { CommonModule } from "@angular/common";
import * as fabric from "fabric";
import { EditorStore } from "../../store/editor.store";
import {
  CustomFabricObject,
  CANVAS_COLORS,
  rotatePoint,
} from "../../utils/canvas.utils";
import { CanvasDrawingService } from "../../services/canvas-drawing.service";
import { CanvasInteractionService } from "../../services/canvas-interaction.service";
import { CanvasStateService } from "../../services/canvas-state.service";
import { CanvasHistoryService } from "../../services/canvas-history.service";
import { ViewportService } from "../../services/viewport.service";
import { ButtonModule } from "primeng/button";
import { TooltipModule } from "primeng/tooltip";

@Component({
  selector: "app-editor-canvas",
  standalone: true,
  imports: [CommonModule, ButtonModule, TooltipModule],
  providers: [
    CanvasDrawingService,
    CanvasInteractionService,
    CanvasStateService,
    CanvasHistoryService,
    ViewportService,
  ],
  templateUrl: "./editor-canvas.component.html",
  styleUrls: ["./editor-canvas.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorCanvasComponent implements OnInit, AfterViewInit, OnDestroy {
  protected readonly store = inject(EditorStore);
  protected readonly drawing = inject(CanvasDrawingService);
  protected readonly interaction = inject(CanvasInteractionService);
  protected readonly state = inject(CanvasStateService);
  protected readonly history = inject(CanvasHistoryService);
  protected readonly viewport = inject(ViewportService);

  private readonly containerRef =
    viewChild<ElementRef<HTMLDivElement>>("container");
  private readonly canvasRef =
    viewChild<ElementRef<HTMLCanvasElement>>("fabricCanvas");

  private canvas: fabric.Canvas | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private gridLines: fabric.Line[] = [];
  private clipboard: fabric.FabricObject[] = [];
  private zoomUnsubscribe: (() => void) | null = null;
  private panUnsubscribe: (() => void) | null = null;
  private canvasInitialized = false;
  private hasAutoFitted = false;

  constructor() {
    effect(() => {
      const zoom = this.store.zoom();
      if (this.canvas && this.canvasInitialized && Math.abs(this.canvas.getZoom() - zoom) > 0.001) {
        this.canvas.setZoom(zoom);
        this.canvas.requestRenderAll();
      }
    });

    effect(() => {
      const bgUrl = this.store.backgroundUrl();
      if (this.canvas && this.canvasInitialized && bgUrl) {
        this.state.loadSvgFromUrl(this.canvas, bgUrl);
      } else if (this.canvas && this.canvasInitialized && !bgUrl) {
        this.state.clearBackground(this.canvas);
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
      this.store.visibleShapes();
      this.store.activeTabId();
      this.store.activeLayerId();

      if (this.canvas && this.canvasInitialized) {
        this.syncShapesWithCanvas();
      }
    });
  }

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.initCanvas();
    this.setupResizeObserver();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.zoomUnsubscribe?.();
    this.panUnsubscribe?.();
    this.canvas?.dispose();
  }

  private initCanvas(): void {
    const canvasEl = this.canvasRef()?.nativeElement;
    const containerEl = this.containerRef()?.nativeElement;
    if (!canvasEl || !containerEl) return;

    this.canvas = new fabric.Canvas(canvasEl, {
      width: containerEl.clientWidth,
      height: containerEl.clientHeight,
      backgroundColor: "#f8f9fa",
      selection: true,
      preserveObjectStacking: true,
      renderOnAddRemove: false,
      perPixelTargetFind: true,
      targetFindTolerance: 4,
      fireMiddleClick: true,
      stopContextMenu: true,
      enableRetinaScaling: false,
      imageSmoothingEnabled: false,
    });

    (this.canvas as any).skipOffscreen = true;

    this.viewport.setViewportSize(containerEl.clientWidth, containerEl.clientHeight);

    this.zoomUnsubscribe = this.viewport.onZoomChange((zoom) => {
      if (this.canvas) {
        this.canvas.setZoom(zoom);
        this.store.setZoom(zoom);
        this.canvas.requestRenderAll();
      }
    });

    this.panUnsubscribe = this.viewport.onPanChange((x, y) => {
      if (this.canvas) {
        const vpt = this.canvas.viewportTransform;
        if (vpt) {
          vpt[4] = x;
          vpt[5] = y;
          this.canvas.requestRenderAll();
        }
      }
    });

    this.setupEventHandlers();
    this.canvasInitialized = true;
    this.updateGridVisible(this.store.showGrid());

    setTimeout(() => {
      this.syncShapesWithCanvas();
    }, 100);
  }

  private setupEventHandlers(): void {
    if (!this.canvas) return;

    this.canvas.on("selection:created", () => this.handleSelection());
    this.canvas.on("selection:updated", () => this.handleSelection());
    this.canvas.on("selection:cleared", () => {
      this.store.clearSelection();
      this.interaction.showContextToolbar.set(false);
    });

    this.canvas.on("object:modified", (e) => {
      const obj = e.target as CustomFabricObject;
      if (obj?.customData?.id) {
        this.store.updateShape(obj.customData.id, {
          x: obj.left || 0,
          y: obj.top || 0,
          rotation: obj.angle || 0,
        });
      }
      this.history.saveState(this.canvas);
    });

    this.canvas.on("mouse:wheel", (opt) => {
      const delta = opt.e.deltaY;
      const currentZoom = this.viewport.zoom();
      const newZoom = currentZoom * 0.999 ** delta;
      this.viewport.setZoom(newZoom, { x: opt.e.offsetX, y: opt.e.offsetY });
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    let isPanning = false;
    let lastPos = { x: 0, y: 0 };

    this.canvas.on("mouse:down", (opt) => {
      const e = opt.e as MouseEvent;
      const pointer = this.canvas!.getPointer(opt.e);
      const tool = this.store.activeTool();

      if (e.button === 1 || (e.altKey && tool !== "pan") || tool === "pan") {
        isPanning = true;
        lastPos = { x: e.clientX, y: e.clientY };
        this.canvas!.selection = false;
        this.containerRef()?.nativeElement.classList.add("panning");
        return;
      }

      switch (tool) {
        case "draw-beam":
          this.drawing.startBeam(this.canvas!, pointer);
          break;
        case "trace-slab":
          const snapped = this.store.findNearestSnapPoint(pointer, 25);
          this.drawing.addPolygonPoint(this.canvas!, snapped || pointer, true);
          break;
        case "draw-polygon":
          this.drawing.addPolygonPoint(this.canvas!, pointer);
          break;
        case "add-panel":
          this.drawing.addPanelAtPoint(this.canvas!, pointer.x, pointer.y);
          break;
        case "add-prop":
          this.drawing.addPropAtPoint(this.canvas!, pointer.x, pointer.y);
          break;
        case "select":
          this.interaction.selectSmallestAtPoint(this.canvas!, pointer);
          break;
      }
    });

    this.canvas.on("mouse:move", (opt) => {
      const e = opt.e as MouseEvent;
      const pointer = this.canvas!.getPointer(opt.e);
      const tool = this.store.activeTool();

      if (isPanning) {
        const deltaX = e.clientX - lastPos.x;
        const deltaY = e.clientY - lastPos.y;
        lastPos = { x: e.clientX, y: e.clientY };
        this.viewport.panBy(deltaX, deltaY);
        return;
      }

      if (tool === "draw-beam" && this.drawing.isDrawingBeam) {
        this.drawing.updateBeamPreview(this.canvas!, pointer);
      } else if (tool === "trace-slab") {
        const snapped = this.store.findNearestSnapPoint(pointer, 25);
        this.interaction.updateSnapGuide(this.canvas!, snapped);
        this.drawing.updatePolygonPreview(
          this.canvas!,
          snapped || pointer,
          true,
        );
      } else if (tool === "draw-polygon") {
        this.drawing.updatePolygonPreview(this.canvas!, pointer);
      }
    });

    this.canvas.on("mouse:up", (opt) => {
      if (isPanning) {
        isPanning = false;
        this.canvas!.selection = this.store.activeTool() === "select";
        this.containerRef()?.nativeElement.classList.remove("panning");
        return;
      }
      if (
        this.store.activeTool() === "draw-beam" &&
        this.drawing.isDrawingBeam
      ) {
        this.drawing.finishBeam(this.canvas!, this.canvas!.getPointer(opt.e));
      }
    });

    this.canvas.on("mouse:dblclick", () => {
      if (this.store.activeTool() === "draw-polygon")
        this.drawing.finishPolygon(this.canvas!);
    });
  }

  private handleSelection(): void {
    const selected = this.canvas?.getActiveObjects() || [];
    const ids = selected
      .map((obj) => (obj as CustomFabricObject).customData?.id)
      .filter(Boolean) as string[];
    this.store.selectMultiple(ids);
    setTimeout(
      () =>
        this.interaction.updateContextToolbarPosition(
          this.canvas!,
          this.containerRef()!.nativeElement,
        ),
      10,
    );
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
    this.gridLines.forEach((l) => this.canvas!.remove(l));
    this.gridLines = [];
    if (!show) {
      this.canvas.requestRenderAll();
      return;
    }

    const size = this.store.gridSize();
    const w = this.canvas.width || 2000,
      h = this.canvas.height || 1500;
    const createLine = (pts: [number, number, number, number]) => {
      const l = new fabric.Line(pts, {
        stroke: CANVAS_COLORS.GRID,
        selectable: false,
        evented: false,
      });
      (l as CustomFabricObject).customData = { isGrid: true };
      return l;
    };
    for (let i = 0; i <= w / size; i++) {
      const l = createLine([i * size, 0, i * size, h]);
      this.gridLines.push(l);
      this.canvas.add(l);
      this.canvas.sendObjectToBack(l);
    }
    for (let i = 0; i <= h / size; i++) {
      const l = createLine([0, i * size, w, i * size]);
      this.gridLines.push(l);
      this.canvas.add(l);
      this.canvas.sendObjectToBack(l);
    }
    this.canvas.requestRenderAll();
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
      shift ? this.history.redo(this.canvas) : this.history.undo(this.canvas);
    } else if (["v", "h", "b", "m", "p", "s"].includes(key) && !ctrl) {
      const tools: any = {
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

  generateFormworkForSelected() {
    const active = this.canvas?.getActiveObject() as CustomFabricObject;
    if (active?.customData?.id) {
      if (this.store.viewMode() === "full") {
        this.store.generateAutoLayout(active.customData.id);
      } else {
        this.store.generateOptimalLayout(active.customData.id);
      }
    }
  }

  deleteSelected() {
    this.canvas?.getActiveObjects().forEach((o) => {
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

  rotateSelected() {
    const active = this.canvas?.getActiveObject();
    if (active) {
      active.rotate((active.angle || 0) + 90);
      this.canvas!.requestRenderAll();
    }
  }

  copySelected() {
    this.clipboard = [];
    this.canvas
      ?.getActiveObjects()
      .forEach((o) => o.clone().then((c) => this.clipboard.push(c)));
  }

  pasteSelected() {
    if (!this.canvas || this.clipboard.length === 0) return;
    this.clipboard.forEach((o, i) =>
      o.clone().then((c) => {
        c.set({ left: (c.left || 0) + 20, top: (c.top || 0) + 20 });
        (c as CustomFabricObject).customData = {
          id: `pasted-${Date.now()}-${i}`,
        };
        this.canvas!.add(c);
      }),
    );
  }

  lockSelected() {
    this.canvas
      ?.getActiveObjects()
      .forEach((o) => o.set({ selectable: false, evented: false }));
    this.canvas?.discardActiveObject();
  }

  selectAll() {
    const objs = this.canvas!.getObjects().filter(
      (o) => !(o as CustomFabricObject).customData?.isGrid && o.selectable,
    );
    if (objs.length)
      this.canvas!.setActiveObject(
        new fabric.ActiveSelection(objs, { canvas: this.canvas! }),
      );
    this.canvas!.requestRenderAll();
  }

  public rotateCanvas(deg: number) {
    if (!this.canvas) return;
    const center = { x: this.canvas.width! / 2, y: this.canvas.height! / 2 };
    this.canvas
      .getObjects()
      .filter((o) => !(o as CustomFabricObject).customData?.isGrid)
      .forEach((o) => {
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

  public loadPolygonsFromGeometry(geom: any): void {
    this.state.loadPolygonsFromGeometry(this.canvas, geom);
  }

  public syncShapesWithCanvas(): void {
    if (!this.canvas) return;

    this.canvas.getObjects().forEach((obj) => {
      const customData = (obj as CustomFabricObject).customData;
      if (
        customData?.id &&
        !customData.isFromSvg &&
        !customData.isGrid
      ) {
        this.canvas?.remove(obj);
      }
    });
    this.canvas?.discardActiveObject();

    const allShapes = this.store.visibleShapes();
    const isAiShape = (id: string) => id?.startsWith('ai-poly-');

    const MAX_AI_SHAPES = 20000;
    const aiShapes = allShapes.filter((s: any) => isAiShape(s.id)).slice(0, MAX_AI_SHAPES);
    const userShapes = allShapes.filter((s: any) => !isAiShape(s.id));
    const shapes = [...userShapes, ...aiShapes];

    this.canvas.renderOnAddRemove = false;

    shapes.forEach((shape: any) => {
      let fabricObj: fabric.FabricObject | null = null;
      const isLocked = shape.layerLocked ?? false;
      const opacity = shape.opacity ?? 1;
      const isAi = isAiShape(shape.id);

      switch (shape.type) {
        case "slab":
        case "polygon":
          if (shape.points && shape.points.length >= 2) {
            if (isAi) {
              fabricObj = new fabric.Polyline(shape.points, {
                left: shape.x || 0,
                top: shape.y || 0,
                fill: 'transparent',
                stroke: '#333333',
                strokeWidth: 0.5,
                objectCaching: true,
                hasControls: false,
                hasBorders: false,
              });
            } else if (shape.points.length >= 3) {
              fabricObj = new fabric.Polygon(shape.points, {
                left: shape.x || 0,
                top: shape.y || 0,
                fill: CANVAS_COLORS.POLYGON_FILL,
                stroke: CANVAS_COLORS.POLYGON_STROKE,
                strokeWidth: 2,
              });
            }
          }
          break;
        case "beam":
          break;
        case "panel":
          fabricObj = new fabric.Rect({
            left: shape.x,
            top: shape.y,
            width: shape.width || 120,
            height: shape.height || 60,
            fill: shape.properties?.fill || CANVAS_COLORS.PANEL_FILL,
            stroke: shape.properties?.stroke || CANVAS_COLORS.PANEL_STROKE,
            strokeWidth: 1,
            angle: shape.rotation || 0,
            originX: "center",
            originY: "center",
          });
          break;
        case "prop":
          fabricObj = new fabric.Circle({
            left: shape.x,
            top: shape.y,
            radius: 15,
            fill: CANVAS_COLORS.PROP_FILL,
            stroke: CANVAS_COLORS.PROP_STROKE,
            strokeWidth: 2,
            angle: shape.rotation || 0,
            originX: "center",
            originY: "center",
          });
          break;
        case "rectangle":
          if (shape.width && shape.height) {
            fabricObj = new fabric.Rect({
              left: shape.x,
              top: shape.y,
              width: shape.width,
              height: shape.height,
              fill: "rgba(200, 200, 200, 0.3)",
              stroke: "#666",
              strokeWidth: 1,
              angle: shape.rotation || 0,
            });
          }
          break;
      }

      if (fabricObj) {
        (fabricObj as CustomFabricObject).customData = {
          id: shape.id,
          type: shape.type as any,
          layerId: shape.layerId,
        };
        fabricObj.set({
          selectable: !isLocked && !isAi,
          evented: !isLocked && !isAi,
          opacity: opacity,
        });
        this.canvas?.add(fabricObj);
      }
    });

    this.canvas.renderOnAddRemove = true;
    this.state.updateObjectCount(this.canvas);
    this.canvas.requestRenderAll();

    const hasObjects = this.canvas.getObjects().some(
      (o) => !(o as CustomFabricObject).customData?.isGrid
    );
    if (!this.hasAutoFitted && hasObjects) {
      this.hasAutoFitted = true;
      setTimeout(() => this.zoomToContent(), 100);
    }
  }

  private zoomToContent(): void {
    if (!this.canvas) return;

    const objects = this.canvas.getObjects().filter(
      (o) => !(o as CustomFabricObject).customData?.isGrid
    );

    if (objects.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    objects.forEach((obj) => {
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
