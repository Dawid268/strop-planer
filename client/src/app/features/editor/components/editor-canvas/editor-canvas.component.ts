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

  private readonly containerRef =
    viewChild<ElementRef<HTMLDivElement>>("container");
  private readonly canvasRef =
    viewChild<ElementRef<HTMLCanvasElement>>("fabricCanvas");

  private canvas: fabric.Canvas | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private gridLines: fabric.Line[] = [];
  private clipboard: fabric.FabricObject[] = [];

  constructor() {
    effect(() => {
      if (this.canvas) {
        this.canvas.setZoom(this.store.zoom());
        this.canvas.requestRenderAll();
      }
    });

    effect(() => this.updateGridVisible(this.store.showGrid()));
    effect(() => this.updateToolMode(this.store.activeTool()));
    effect(() => this.updateViewMode(this.store.viewMode()));

    effect(() => {
      const shapes = this.store.shapes();
      const layers = this.store.layers();
      const activeLayerId = this.store.activeLayerId();

      if (this.canvas) {
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
    });

    this.setupEventHandlers();
    this.updateGridVisible(this.store.showGrid());
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
      let zoom = (this.canvas?.getZoom() || 1) * 0.999 ** delta;
      zoom = Math.max(0.1, Math.min(5, zoom));
      this.canvas!.zoomToPoint(
        new fabric.Point(opt.e.offsetX, opt.e.offsetY),
        zoom,
      );
      this.store.setZoom(zoom);
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
        const vpt = this.canvas!.viewportTransform!;
        vpt[4] += e.clientX - lastPos.x;
        vpt[5] += e.clientY - lastPos.y;
        lastPos = { x: e.clientX, y: e.clientY };
        this.canvas!.requestRenderAll();
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
        this.canvas?.setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
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

    // Clear only existing store-managed shapes
    this.canvas.getObjects().forEach((obj) => {
      const customData = (obj as CustomFabricObject).customData;
      if (
        customData?.id &&
        !customData.isFromSvg &&
        !customData.isFromGeometry &&
        !customData.isGrid
      ) {
        this.canvas?.remove(obj);
      }
    });
    this.canvas?.discardActiveObject();

    const shapes = this.store.visibleShapes();
    const layers = this.store.layers();

    shapes.forEach((shape) => {
      let fabricObj: fabric.FabricObject | null = null;
      const layer = layers.find((l) => l.name === shape.layer);
      const isLocked = layer?.locked ?? false;
      const opacity = layer?.opacity ?? 1;

      switch (shape.type) {
        case "slab":
        case "polygon":
          if (shape.points) {
            fabricObj = new fabric.Polygon(shape.points, {
              fill: CANVAS_COLORS.POLYGON_FILL,
              stroke: CANVAS_COLORS.POLYGON_STROKE,
              strokeWidth: 2,
            });
          }
          break;
        case "beam":
          // assume beams are lines
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
      }

      if (fabricObj) {
        (fabricObj as CustomFabricObject).customData = {
          id: shape.id,
          type: shape.type as any,
        };
        fabricObj.set({
          selectable: !isLocked,
          evented: !isLocked,
          opacity: opacity,
        });
        this.canvas?.add(fabricObj);
      }
    });

    this.state.updateObjectCount(this.canvas);
    this.canvas.requestRenderAll();
  }
}
