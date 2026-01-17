import {
  Component,
  ElementRef,
  OnInit,
  OnDestroy,
  inject,
  signal,
  viewChild,
  effect,
  AfterViewInit,
  HostListener,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import * as fabric from "fabric";
import { EditorStore } from "../store/editor.store";
import { type Shape, type Point } from "../models/editor.models";
import { ButtonModule } from "primeng/button";
import { TooltipModule } from "primeng/tooltip";

// Extend FabricObject to include custom data property
interface CustomFabricObject extends fabric.FabricObject {
  customData?: {
    id?: string;
    isGrid?: boolean;
    isFromSvg?: boolean;
    isFromGeometry?: boolean;
    type?: string;
  };
}

@Component({
  selector: "app-editor-canvas",
  standalone: true,
  imports: [CommonModule, ButtonModule, TooltipModule],
  template: `
    <div
      class="canvas-container w-full h-full overflow-hidden bg-gray-100 relative"
      #container
      tabindex="0"
    >
      <canvas #fabricCanvas></canvas>

      <!-- Context Toolbar (appears near selection) -->
      @if (showContextToolbar() && contextToolbarPosition()) {
        <div
          class="context-toolbar absolute flex gap-1 p-1 bg-white shadow-3 border-round-lg"
          [style.left.px]="contextToolbarPosition()!.x"
          [style.top.px]="contextToolbarPosition()!.y"
        >
          <button
            pButton
            icon="pi pi-trash"
            class="p-button-danger p-button-sm p-button-text"
            pTooltip="Usuń (Del)"
            tooltipPosition="top"
            (click)="deleteSelected()"
          ></button>
          <button
            pButton
            icon="pi pi-refresh"
            class="p-button-sm p-button-text"
            pTooltip="Obróć 90° (R)"
            tooltipPosition="top"
            (click)="rotateSelected()"
          ></button>
          <button
            pButton
            icon="pi pi-copy"
            class="p-button-sm p-button-text"
            pTooltip="Kopiuj (Ctrl+C)"
            tooltipPosition="top"
            (click)="copySelected()"
          ></button>
          <button
            pButton
            icon="pi pi-lock"
            class="p-button-sm p-button-text"
            pTooltip="Zablokuj"
            tooltipPosition="top"
            (click)="lockSelected()"
          ></button>
        </div>
      }

      <!-- Loading overlay -->
      @if (isLoading()) {
        <div
          class="absolute inset-0 flex align-items-center justify-content-center bg-white-alpha-70"
        >
          <div class="flex flex-column align-items-center gap-3">
            <i class="pi pi-spin pi-spinner text-4xl text-primary"></i>
            <span class="text-600">Ładowanie wektorów...</span>
          </div>
        </div>
      }

      <!-- Empty state -->
      @if (!isLoading() && objectCount() === 0) {
        <div
          class="absolute inset-0 flex align-items-center justify-content-center pointer-events-none"
        >
          <div class="text-center opacity-50">
            <i class="pi pi-compass text-8xl mb-4 text-400"></i>
            <h3 class="text-3xl font-medium text-900 m-0">
              Twój projekt jest pusty
            </h3>
            <p class="text-600 mt-2">
              Zaimportuj plik SVG lub narysuj kształty
            </p>
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .canvas-container {
        touch-action: none;
        outline: none;
      }

      .canvas-container.panning,
      .canvas-container.panning .upper-canvas,
      .canvas-container.panning .lower-canvas {
        cursor: grabbing !important;
      }

      canvas {
        display: block;
      }

      .inset-0 {
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
      }

      .context-toolbar {
        z-index: 1000;
        pointer-events: auto;
      }
    `,
  ],
})
export class EditorCanvasComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly store = inject(EditorStore);

  private readonly containerRef =
    viewChild<ElementRef<HTMLDivElement>>("container");
  private readonly canvasRef =
    viewChild<ElementRef<HTMLCanvasElement>>("fabricCanvas");

  private canvas: fabric.Canvas | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private gridLines: fabric.FabricObject[] = [];

  public readonly isLoading = signal(false);
  public readonly objectCount = signal(0);
  public readonly showContextToolbar = signal(false);
  public readonly contextToolbarPosition = signal<{
    x: number;
    y: number;
  } | null>(null);

  // Clipboard for copy/paste
  private clipboard: fabric.FabricObject[] = [];

  // Canvas rotation angle
  public canvasRotation = signal(0);

  // Track current SVG URL to avoid reloading
  private currentSvgUrl: string | null = null;

  // Drawing state
  private isDrawingBeam = false;
  private beamStartPoint: { x: number; y: number } | null = null;
  private currentBeamLine: fabric.Line | null = null;
  private polygonPoints: { x: number; y: number }[] = [];
  private polygonPreviewLine: fabric.Line | null = null;
  private polygonMarkers: fabric.Circle[] = [];

  // ========== UNDO/REDO HISTORY ==========
  private historyStack: string[] = [];
  private historyIndex = -1;
  private readonly MAX_HISTORY = 50;
  private isRestoring = false; // Prevent saving state during restore

  // ========== SELECTION CYCLING (FreeCAD-style) ==========
  private lastClickPos: { x: number; y: number } | null = null;
  private overlappingObjects: fabric.FabricObject[] = [];
  private currentOverlapIndex = 0;

  constructor() {
    // Effect for zoom changes
    effect(() => {
      const zoom = this.store.zoom();
      if (this.canvas) {
        this.canvas.setZoom(zoom);
        this.canvas.requestRenderAll();
      }
    });

    // Effect for grid visibility
    effect(() => {
      const showGrid = this.store.showGrid();
      this.updateGrid(showGrid);
    });

    // Effect for tool changes
    effect(() => {
      const tool = this.store.activeTool();
      if (this.canvas) {
        this.updateToolMode(tool);
      }
    });
  }

  private updateToolMode(tool: string): void {
    if (!this.canvas) return;

    // Reset drawing states when changing tools
    this.cancelCurrentDrawing();

    switch (tool) {
      case "select":
        this.canvas.selection = true;
        this.canvas.defaultCursor = "default";
        this.canvas.hoverCursor = "move";
        break;
      case "pan":
        this.canvas.selection = false;
        this.canvas.defaultCursor = "grab";
        this.canvas.hoverCursor = "grab";
        break;
      case "draw-beam":
        this.canvas.selection = false;
        this.canvas.defaultCursor = "crosshair";
        this.canvas.hoverCursor = "crosshair";
        break;
      case "draw-polygon":
        this.canvas.selection = false;
        this.canvas.defaultCursor = "crosshair";
        this.canvas.hoverCursor = "crosshair";
        break;
      case "add-panel":
      case "add-prop":
        this.canvas.selection = false;
        this.canvas.defaultCursor = "cell";
        this.canvas.hoverCursor = "cell";
        break;
    }

    this.canvas.requestRenderAll();
  }

  private cancelCurrentDrawing(): void {
    // Clear beam drawing
    this.isDrawingBeam = false;
    this.beamStartPoint = null;
    if (this.currentBeamLine && this.canvas) {
      this.canvas.remove(this.currentBeamLine);
      this.currentBeamLine = null;
    }

    // Clear polygon drawing
    this.polygonPoints = [];
    if (this.polygonPreviewLine && this.canvas) {
      this.canvas.remove(this.polygonPreviewLine);
      this.polygonPreviewLine = null;
    }
    this.polygonMarkers.forEach((marker) => {
      if (this.canvas) this.canvas.remove(marker);
    });
    this.polygonMarkers = [];
  }

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.initCanvas();
    this.setupResizeObserver();
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.canvas) {
      this.canvas.dispose();
    }
  }

  private initCanvas(): void {
    const canvasEl = this.canvasRef()?.nativeElement;
    const containerEl = this.containerRef()?.nativeElement;

    if (!canvasEl || !containerEl) return;

    const width = containerEl.clientWidth;
    const height = containerEl.clientHeight;

    this.canvas = new fabric.Canvas(canvasEl, {
      width,
      height,
      backgroundColor: "#f8f9fa",
      selection: true,
      preserveObjectStacking: true,
      renderOnAddRemove: false, // Performance: batch renders
      perPixelTargetFind: true, // Precise selection on actual pixels
      targetFindTolerance: 4, // 4px tolerance for thin lines
      enableRetinaScaling: false, // Performance: disable retina
      imageSmoothingEnabled: false, // Performance: faster rendering
      skipOffscreen: true, // Performance: skip offscreen objects
    });

    // Setup event handlers
    this.setupEventHandlers();

    // Draw initial grid
    this.updateGrid(this.store.showGrid());

    console.log("Fabric.js canvas initialized", { width, height });
  }

  private setupEventHandlers(): void {
    if (!this.canvas) return;

    // Selection events
    this.canvas.on("selection:created", (e) => {
      const selected = e.selected || [];
      const ids = selected
        .map((obj) => (obj as CustomFabricObject).customData?.id)
        .filter(Boolean) as string[];
      if (ids.length > 0) {
        this.store.selectMultiple(ids);
      }
      // Show context toolbar
      setTimeout(() => this.updateContextToolbarPosition(), 10);
    });

    this.canvas.on("selection:updated", (e) => {
      const selected = e.selected || [];
      const ids = selected
        .map((obj) => (obj as CustomFabricObject).customData?.id)
        .filter(Boolean) as string[];
      this.store.selectMultiple(ids);
      // Update context toolbar position
      setTimeout(() => this.updateContextToolbarPosition(), 10);
    });

    this.canvas.on("selection:cleared", () => {
      this.store.clearSelection();
      this.showContextToolbar.set(false);
    });

    // Object modification
    this.canvas.on("object:modified", (e) => {
      const obj = e.target as CustomFabricObject;
      if (obj && obj.customData?.id) {
        this.store.updateShape(obj.customData.id, {
          x: obj.left || 0,
          y: obj.top || 0,
          rotation: obj.angle || 0,
        });
      }
      // Save state for undo/redo
      this.saveState();
    });

    // Mouse wheel zoom
    this.canvas.on("mouse:wheel", (opt) => {
      const delta = opt.e.deltaY;
      let zoom = this.canvas!.getZoom();
      zoom *= 0.999 ** delta;
      zoom = Math.max(0.1, Math.min(5, zoom));

      this.canvas!.zoomToPoint(
        new fabric.Point(opt.e.offsetX, opt.e.offsetY),
        zoom,
      );
      this.store.setZoom(zoom);

      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    // Pan and drawing state
    let isPanning = false;
    let lastPosX = 0;
    let lastPosY = 0;

    this.canvas.on("mouse:down", (opt) => {
      const e = opt.e as MouseEvent;
      const pointer = this.canvas!.getPointer(opt.e);
      const tool = this.store.activeTool();

      // Handle middle mouse or alt+drag for panning
      if (e.button === 1 || (e.altKey && tool !== "pan")) {
        e.preventDefault(); // Prevent browser scroll behavior
        e.stopPropagation();
        isPanning = true;
        lastPosX = e.clientX;
        lastPosY = e.clientY;
        this.canvas!.selection = false;
        // Add panning class for grabbing cursor (CSS with !important)
        const containerEl = this.containerRef()?.nativeElement;
        if (containerEl) containerEl.classList.add("panning");
        return;
      }

      // Handle tool-specific actions
      switch (tool) {
        case "pan":
          isPanning = true;
          lastPosX = e.clientX;
          lastPosY = e.clientY;
          break;

        case "draw-beam":
          if (!this.isDrawingBeam) {
            // Start drawing beam
            this.isDrawingBeam = true;
            this.beamStartPoint = { x: pointer.x, y: pointer.y };
            this.currentBeamLine = new fabric.Line(
              [pointer.x, pointer.y, pointer.x, pointer.y],
              {
                stroke: "#ff6600",
                strokeWidth: 3,
                strokeLineCap: "round",
                selectable: false,
                evented: false,
              },
            );
            this.canvas!.add(this.currentBeamLine);
          }
          break;

        case "draw-polygon":
          // Add point to polygon
          this.polygonPoints.push({ x: pointer.x, y: pointer.y });

          // Add visual marker
          const marker = new fabric.Circle({
            left: pointer.x - 5,
            top: pointer.y - 5,
            radius: 5,
            fill: "#2196f3",
            stroke: "#1565c0",
            strokeWidth: 2,
            selectable: false,
            evented: false,
          });
          this.polygonMarkers.push(marker);
          this.canvas!.add(marker);

          // Check if closing the polygon (clicking near first point)
          if (this.polygonPoints.length >= 3) {
            const first = this.polygonPoints[0];
            const dist = Math.sqrt(
              Math.pow(pointer.x - first.x, 2) +
                Math.pow(pointer.y - first.y, 2),
            );
            if (dist < 20) {
              this.finishPolygon();
            }
          }
          break;

        case "add-panel":
          this.addPanelAtPoint(pointer.x, pointer.y);
          break;

        case "add-prop":
          this.addPropAtPoint(pointer.x, pointer.y);
          break;

        case "select":
          // Custom selection: smallest element first, cycle on repeated clicks
          this.selectSmallestAtPoint(pointer);
          break;
      }

      this.canvas!.requestRenderAll();
    });

    this.canvas.on("mouse:move", (opt) => {
      const e = opt.e as MouseEvent;
      const pointer = this.canvas!.getPointer(opt.e);
      const tool = this.store.activeTool();

      if (isPanning) {
        const vpt = this.canvas!.viewportTransform!;
        vpt[4] += e.clientX - lastPosX;
        vpt[5] += e.clientY - lastPosY;
        lastPosX = e.clientX;
        lastPosY = e.clientY;
        this.canvas!.requestRenderAll();
        return;
      }

      // Update beam preview
      if (tool === "draw-beam" && this.isDrawingBeam && this.currentBeamLine) {
        this.currentBeamLine.set({
          x2: pointer.x,
          y2: pointer.y,
        });
        this.canvas!.requestRenderAll();
      }

      // Update polygon preview line
      if (tool === "draw-polygon" && this.polygonPoints.length > 0) {
        if (this.polygonPreviewLine) {
          this.canvas!.remove(this.polygonPreviewLine);
        }
        const lastPoint = this.polygonPoints[this.polygonPoints.length - 1];
        this.polygonPreviewLine = new fabric.Line(
          [lastPoint.x, lastPoint.y, pointer.x, pointer.y],
          {
            stroke: "#2196f3",
            strokeWidth: 2,
            strokeDashArray: [5, 5],
            selectable: false,
            evented: false,
          },
        );
        this.canvas!.add(this.polygonPreviewLine);
        this.canvas!.requestRenderAll();
      }
    });

    this.canvas.on("mouse:up", (opt) => {
      const pointer = this.canvas!.getPointer(opt.e);
      const tool = this.store.activeTool();

      if (isPanning) {
        isPanning = false;
        if (tool === "select") {
          this.canvas!.selection = true;
        }
        // Remove panning class to reset cursor
        const containerEl = this.containerRef()?.nativeElement;
        if (containerEl) containerEl.classList.remove("panning");
        return;
      }

      // Finish beam drawing
      if (tool === "draw-beam" && this.isDrawingBeam && this.beamStartPoint) {
        if (this.currentBeamLine) {
          this.canvas!.remove(this.currentBeamLine);
        }

        // Create the final beam
        const beam = new fabric.Line(
          [this.beamStartPoint.x, this.beamStartPoint.y, pointer.x, pointer.y],
          {
            stroke: "#ff6600",
            strokeWidth: 3,
            strokeLineCap: "round",
            selectable: true,
            evented: true,
          },
        );
        (beam as CustomFabricObject).customData = {
          id: `beam-${Date.now()}`,
          type: "beam",
        };
        this.canvas!.add(beam);

        this.isDrawingBeam = false;
        this.beamStartPoint = null;
        this.currentBeamLine = null;
        this.updateObjectCount();
        this.canvas!.requestRenderAll();
      }
    });

    // Double-click to finish polygon
    this.canvas.on("mouse:dblclick", () => {
      if (
        this.store.activeTool() === "draw-polygon" &&
        this.polygonPoints.length >= 3
      ) {
        this.finishPolygon();
      }
    });
  }

  private finishPolygon(): void {
    if (!this.canvas || this.polygonPoints.length < 3) return;

    // Remove preview elements
    if (this.polygonPreviewLine) {
      this.canvas.remove(this.polygonPreviewLine);
      this.polygonPreviewLine = null;
    }
    this.polygonMarkers.forEach((marker) => this.canvas!.remove(marker));
    this.polygonMarkers = [];

    // Create the polygon
    const polygon = new fabric.Polygon(this.polygonPoints, {
      fill: "rgba(100, 149, 237, 0.4)",
      stroke: "#1565c0",
      strokeWidth: 2,
      selectable: true,
      evented: true,
    });
    (polygon as CustomFabricObject).customData = {
      id: `polygon-${Date.now()}`,
      type: "slab",
    };
    this.canvas.add(polygon);

    this.polygonPoints = [];
    this.updateObjectCount();
    this.canvas.requestRenderAll();
  }

  private addPanelAtPoint(x: number, y: number): void {
    if (!this.canvas) return;

    const catalogItem = this.store.activeCatalogItem();
    const width = catalogItem?.width || 120;
    const height = catalogItem?.length || 60;

    const panel = new fabric.Rect({
      left: x - width / 2,
      top: y - height / 2,
      width,
      height,
      fill: "rgba(200, 230, 201, 0.8)",
      stroke: "#2e7d32",
      strokeWidth: 2,
      rx: 4,
      ry: 4,
      selectable: true,
      evented: true,
    });
    (panel as CustomFabricObject).customData = {
      id: `panel-${Date.now()}`,
      type: "panel",
    };
    this.canvas.add(panel);
    this.updateObjectCount();
    this.canvas.requestRenderAll();
  }

  private addPropAtPoint(x: number, y: number): void {
    if (!this.canvas) return;

    const prop = new fabric.Circle({
      left: x - 15,
      top: y - 15,
      radius: 15,
      fill: "#ffeb3b",
      stroke: "#f57c00",
      strokeWidth: 2,
      selectable: true,
      evented: true,
    });
    (prop as CustomFabricObject).customData = {
      id: `prop-${Date.now()}`,
      type: "prop",
    };
    this.canvas.add(prop);
    this.updateObjectCount();
    this.canvas.requestRenderAll();
  }

  private setupResizeObserver(): void {
    const containerEl = this.containerRef()?.nativeElement;
    if (!containerEl) return;

    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (this.canvas) {
          this.canvas.setDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height,
          });
          this.canvas.requestRenderAll();
        }
      }
    });

    this.resizeObserver.observe(containerEl);
  }

  private updateGrid(show: boolean): void {
    if (!this.canvas) return;

    // Remove existing grid lines
    this.gridLines.forEach((line) => {
      this.canvas!.remove(line);
    });
    this.gridLines = [];

    if (!show) {
      this.canvas.requestRenderAll();
      return;
    }

    const gridSize = this.store.gridSize();
    const width = this.canvas.width || 2000;
    const height = this.canvas.height || 1500;

    // Create grid lines
    for (let i = 0; i <= width / gridSize; i++) {
      const line = new fabric.Line([i * gridSize, 0, i * gridSize, height], {
        stroke: "#e0e0e0",
        strokeWidth: 1,
        selectable: false,
        evented: false,
      });
      (line as CustomFabricObject).customData = { isGrid: true };
      this.gridLines.push(line);
      this.canvas.add(line);
      this.canvas.sendObjectToBack(line);
    }

    for (let i = 0; i <= height / gridSize; i++) {
      const line = new fabric.Line([0, i * gridSize, width, i * gridSize], {
        stroke: "#e0e0e0",
        strokeWidth: 1,
        selectable: false,
        evented: false,
      });
      (line as CustomFabricObject).customData = { isGrid: true };
      this.gridLines.push(line);
      this.canvas.add(line);
      this.canvas.sendObjectToBack(line);
    }

    this.canvas.requestRenderAll();
  }

  /**
   * Load SVG from URL into the canvas as editable objects
   * Uses batch loading to avoid blocking the main thread
   */
  public async loadSvgFromUrl(url: string): Promise<void> {
    if (!this.canvas || this.currentSvgUrl === url) return;

    this.isLoading.set(true);
    this.currentSvgUrl = url;

    const startTime = performance.now();
    console.log("Loading SVG from URL:", url);

    try {
      const result = await fabric.loadSVGFromURL(url);

      if (!result.objects || result.objects.length === 0) {
        console.warn("No objects found in SVG");
        this.isLoading.set(false);
        return;
      }

      // Clear existing non-grid objects
      const existingObjects = this.canvas.getObjects();
      existingObjects.forEach((obj) => {
        if (!(obj as CustomFabricObject).customData?.isGrid) {
          this.canvas!.remove(obj);
        }
      });

      // Batch loading config
      const BATCH_SIZE = 200;
      const objects = result.objects.filter(
        (o): o is fabric.FabricObject => o !== null,
      );
      const totalObjects = objects.length;
      let processedCount = 0;

      console.log(
        `Batch loading ${totalObjects} objects (batch size: ${BATCH_SIZE})`,
      );

      // Process in batches using requestIdleCallback
      const processBatch = (deadline?: IdleDeadline) => {
        const batchEnd = Math.min(processedCount + BATCH_SIZE, totalObjects);

        while (processedCount < batchEnd) {
          const obj = objects[processedCount];
          obj.set({
            selectable: true,
            evented: true,
            hasControls: true,
            hasBorders: true,
            lockScalingFlip: true,
            objectCaching: true,
            statefullCache: false,
            noScaleCache: true,
          });

          (obj as CustomFabricObject).customData = {
            id: `svg-obj-${processedCount}`,
            isFromSvg: true,
          };

          this.canvas!.add(obj);
          processedCount++;

          if (deadline && deadline.timeRemaining() < 1) break;
        }

        this.objectCount.set(processedCount);

        if (processedCount < totalObjects) {
          if ("requestIdleCallback" in window) {
            (window as any).requestIdleCallback(processBatch, { timeout: 100 });
          } else {
            setTimeout(() => processBatch(), 0);
          }
        } else {
          // Done - finalize
          this.fitContentToView();
          this.canvas!.requestRenderAll();
          const loadTime = Math.round(performance.now() - startTime);
          console.log(`Loaded ${processedCount} objects in ${loadTime}ms`);
          this.isLoading.set(false);

          // Save initial state for undo/redo
          this.saveState();
        }
      };

      // Start batch processing
      if ("requestIdleCallback" in window) {
        (window as any).requestIdleCallback(processBatch, { timeout: 100 });
      } else {
        processBatch();
      }
    } catch (error) {
      console.error("Failed to load SVG:", error);
      this.isLoading.set(false);
    }
  }

  /**
   * Load polygons from Python-extracted geometry data
   * Each polygon becomes a separate selectable Fabric.js object
   * This provides much better selection precision than raw SVG paths
   */
  public loadPolygonsFromGeometry(geometryData: {
    polygons: Array<Array<{ x: number; y: number }>>;
    metadata?: any;
  }): void {
    if (!this.canvas || !geometryData?.polygons) {
      console.warn("Cannot load polygons: canvas or data not ready");
      return;
    }

    this.isLoading.set(true);
    const startTime = performance.now();
    const polygons = geometryData.polygons;

    console.log(`Loading ${polygons.length} polygons from geometry data`);

    // Clear existing non-grid objects
    const existingObjects = this.canvas.getObjects();
    existingObjects.forEach((obj) => {
      if (!(obj as CustomFabricObject).customData?.isGrid) {
        this.canvas!.remove(obj);
      }
    });

    // Batch processing config
    const BATCH_SIZE = 200;
    let processedCount = 0;

    const processBatch = (deadline?: IdleDeadline) => {
      const batchEnd = Math.min(processedCount + BATCH_SIZE, polygons.length);

      while (processedCount < batchEnd) {
        const polyPoints = polygons[processedCount];

        // Skip invalid polygons
        if (!polyPoints || polyPoints.length < 2) {
          processedCount++;
          continue;
        }

        // Create Fabric.js Polygon or Polyline based on point count
        let fabricObj: fabric.FabricObject;

        if (polyPoints.length === 2) {
          // Line (2 points)
          fabricObj = new fabric.Line(
            [
              polyPoints[0].x,
              polyPoints[0].y,
              polyPoints[1].x,
              polyPoints[1].y,
            ],
            {
              stroke: "#333333",
              strokeWidth: 1,
              fill: "",
              selectable: true,
              evented: true,
              hasControls: true,
              hasBorders: true,
              objectCaching: true,
            },
          );
        } else if (polyPoints.length >= 3) {
          // Polygon (3+ points)
          fabricObj = new fabric.Polygon(
            polyPoints.map((p) => ({ x: p.x, y: p.y })),
            {
              stroke: "#333333",
              strokeWidth: 1,
              fill: "transparent",
              selectable: true,
              evented: true,
              hasControls: true,
              hasBorders: true,
              objectCaching: true,
              perPixelTargetFind: true,
            },
          );
        } else {
          processedCount++;
          continue;
        }

        (fabricObj as CustomFabricObject).customData = {
          id: `polygon-${processedCount}`,
          isFromGeometry: true,
        };

        this.canvas!.add(fabricObj);
        processedCount++;

        if (deadline && deadline.timeRemaining() < 1) break;
      }

      this.objectCount.set(processedCount);

      if (processedCount < polygons.length) {
        if ("requestIdleCallback" in window) {
          (window as any).requestIdleCallback(processBatch, { timeout: 100 });
        } else {
          setTimeout(() => processBatch(), 0);
        }
      } else {
        // Done
        this.fitContentToView();
        this.canvas!.requestRenderAll();
        const loadTime = Math.round(performance.now() - startTime);
        console.log(`Loaded ${processedCount} polygons in ${loadTime}ms`);
        this.isLoading.set(false);
        this.saveState();
      }
    };

    // Start batch processing
    if ("requestIdleCallback" in window) {
      (window as any).requestIdleCallback(processBatch, { timeout: 100 });
    } else {
      processBatch();
    }
  }

  /**
   * Fit all content to the visible canvas area
   */
  private fitContentToView(): void {
    if (!this.canvas) return;

    const objects = this.canvas
      .getObjects()
      .filter((obj) => !(obj as CustomFabricObject).customData?.isGrid);
    if (objects.length === 0) return;

    // Calculate bounding box manually
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    objects.forEach((obj) => {
      const bound = obj.getBoundingRect();
      minX = Math.min(minX, bound.left);
      minY = Math.min(minY, bound.top);
      maxX = Math.max(maxX, bound.left + bound.width);
      maxY = Math.max(maxY, bound.top + bound.height);
    });

    const boundsWidth = maxX - minX;
    const boundsHeight = maxY - minY;

    const canvasWidth = this.canvas.width || 800;
    const canvasHeight = this.canvas.height || 600;

    const scaleX = (canvasWidth * 0.9) / boundsWidth;
    const scaleY = (canvasHeight * 0.9) / boundsHeight;
    const scale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 100%

    this.canvas.setZoom(scale);
    this.store.setZoom(scale);

    // Center the content
    const vpt = this.canvas.viewportTransform!;
    vpt[4] = (canvasWidth - boundsWidth * scale) / 2 - minX * scale;
    vpt[5] = (canvasHeight - boundsHeight * scale) / 2 - minY * scale;

    this.canvas.requestRenderAll();
  }

  /**
   * Add a shape to the canvas
   */
  public addShape(shape: Shape): void {
    if (!this.canvas) return;

    let fabricObj: fabric.FabricObject | null = null;

    switch (shape.type) {
      case "rectangle":
        fabricObj = new fabric.Rect({
          left: shape.x,
          top: shape.y,
          width: (shape as any).width || 100,
          height: (shape as any).height || 100,
          fill: "rgba(255, 204, 0, 0.5)",
          stroke: "#000",
          strokeWidth: 2,
          angle: shape.rotation || 0,
        });
        break;

      case "polygon":
        if (shape.points && shape.points.length >= 3) {
          fabricObj = new fabric.Polygon(
            shape.points.map((p) => ({ x: p.x + shape.x, y: p.y + shape.y })),
            {
              fill: "rgba(100, 149, 237, 0.3)",
              stroke: "#000",
              strokeWidth: 2,
            },
          );
        }
        break;

      case "panel":
        fabricObj = new fabric.Rect({
          left: shape.x,
          top: shape.y,
          width: (shape as any).length || 100,
          height: (shape as any).width || 50,
          fill: "rgba(200, 230, 201, 0.8)",
          stroke: "#2e7d32",
          strokeWidth: 2,
          rx: 4,
          ry: 4,
          angle: shape.rotation || 0,
        });
        break;
    }

    if (fabricObj) {
      (fabricObj as CustomFabricObject).customData = {
        id: shape.id,
        type: shape.type,
      };
      this.canvas.add(fabricObj);
      this.canvas.requestRenderAll();
      this.updateObjectCount();
    }
  }

  private updateObjectCount(): void {
    if (!this.canvas) return;
    const count = this.canvas
      .getObjects()
      .filter((o) => !(o as CustomFabricObject).customData?.isGrid).length;
    this.objectCount.set(count);
  }

  /**
   * Clear all objects except grid
   */
  public clearCanvas(): void {
    if (!this.canvas) return;

    const objects = this.canvas.getObjects();
    objects.forEach((obj) => {
      if (!(obj as CustomFabricObject).customData?.isGrid) {
        this.canvas!.remove(obj);
      }
    });

    this.objectCount.set(0);
    this.currentSvgUrl = null;
    this.canvas.requestRenderAll();
  }

  /**
   * Export canvas to SVG
   */
  public exportToSvg(): string {
    if (!this.canvas) return "";
    return this.canvas.toSVG();
  }

  /**
   * Export canvas to JSON
   */
  public exportToJson(): object {
    if (!this.canvas) return {};
    return this.canvas.toJSON();
  }

  /**
   * Reset zoom and pan
   */
  public resetView(): void {
    if (!this.canvas) return;

    this.canvas.setZoom(1);
    this.canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
    this.store.setZoom(1);
    this.canvas.requestRenderAll();
  }

  // ========== KEYBOARD SHORTCUTS ==========

  @HostListener("document:keydown", ["$event"])
  onKeyDown(event: KeyboardEvent): void {
    // Don't handle if typing in input
    if (
      (event.target as HTMLElement).tagName === "INPUT" ||
      (event.target as HTMLElement).tagName === "TEXTAREA"
    ) {
      return;
    }

    const key = event.key.toLowerCase();
    const ctrl = event.ctrlKey || event.metaKey;
    const shift = event.shiftKey;

    // Delete selected objects
    if (key === "delete" || key === "backspace") {
      event.preventDefault();
      this.deleteSelected();
      return;
    }

    // Escape - deselect and cancel drawing
    if (key === "escape") {
      this.cancelCurrentDrawing();
      if (this.canvas) {
        this.canvas.discardActiveObject();
        this.canvas.requestRenderAll();
      }
      this.showContextToolbar.set(false);
      this.store.setActiveTool("select");
      return;
    }

    // Rotate selected 90°
    if (key === "r" && !ctrl) {
      event.preventDefault();
      this.rotateSelected();
      return;
    }

    // Ctrl+C - Copy
    if (key === "c" && ctrl) {
      event.preventDefault();
      this.copySelected();
      return;
    }

    // Ctrl+V - Paste
    if (key === "v" && ctrl) {
      event.preventDefault();
      this.pasteClipboard();
      return;
    }

    // Ctrl+A - Select all
    if (key === "a" && ctrl) {
      event.preventDefault();
      this.selectAll();
      return;
    }

    if (key === "z" && ctrl && !shift) {
      event.preventDefault();
      this.undo();
      return;
    }

    // Ctrl+Y or Ctrl+Shift+Z - Redo
    if ((key === "y" && ctrl) || (key === "z" && ctrl && shift)) {
      event.preventDefault();
      this.redo();
      return;
    } // Tool shortcuts
    if (!ctrl) {
      switch (key) {
        case "v":
          this.store.setActiveTool("select");
          break;
        case "h":
          this.store.setActiveTool("pan");
          break;
        case "b":
          this.store.setActiveTool("draw-beam");
          break;
        case "p":
          this.store.setActiveTool("draw-polygon");
          break;
        case "s":
          this.store.setActiveTool("add-prop");
          break;
      }
    }

    // Arrow keys - move selection
    if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
      event.preventDefault();
      const moveAmount = shift ? 10 : 1;
      this.moveSelected(key, moveAmount);
    }
  }

  // ========== CONTEXT TOOLBAR ACTIONS ==========

  public deleteSelected(): void {
    if (!this.canvas) return;

    const active = this.canvas.getActiveObjects();
    if (active.length === 0) return;

    active.forEach((obj) => {
      if (!(obj as CustomFabricObject).customData?.isGrid) {
        this.canvas!.remove(obj);
      }
    });

    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    this.showContextToolbar.set(false);
    this.updateObjectCount();
    this.store.clearSelection();

    // Save state for undo
    this.saveState();
  }

  public rotateSelected(): void {
    if (!this.canvas) return;

    const active = this.canvas.getActiveObject();
    if (!active) return;

    active.rotate((active.angle || 0) + 90);
    this.canvas.requestRenderAll();
    this.updateContextToolbarPosition();
  }

  public copySelected(): void {
    if (!this.canvas) return;

    const active = this.canvas.getActiveObjects();
    if (active.length === 0) return;

    // Clone objects
    this.clipboard = [];
    active.forEach((obj) => {
      obj.clone().then((cloned: fabric.FabricObject) => {
        this.clipboard.push(cloned);
      });
    });
  }

  public pasteClipboard(): void {
    if (!this.canvas || this.clipboard.length === 0) return;

    this.canvas.discardActiveObject();

    const pastedObjects: fabric.FabricObject[] = [];
    let pasteCount = 0;

    this.clipboard.forEach((obj, index) => {
      obj.clone().then((cloned: fabric.FabricObject) => {
        cloned.set({
          left: (cloned.left || 0) + 20,
          top: (cloned.top || 0) + 20,
          evented: true,
          selectable: true,
        });
        (cloned as CustomFabricObject).customData = {
          id: `pasted-${Date.now()}-${index}`,
        };

        this.canvas!.add(cloned);
        pastedObjects.push(cloned);
        pasteCount++;

        if (pasteCount === this.clipboard.length) {
          // Select all pasted objects
          if (pastedObjects.length === 1) {
            this.canvas!.setActiveObject(pastedObjects[0]);
          } else {
            const selection = new fabric.ActiveSelection(pastedObjects, {
              canvas: this.canvas!,
            });
            this.canvas!.setActiveObject(selection);
          }
          this.canvas!.requestRenderAll();
          this.updateObjectCount();
        }
      });
    });
  }

  public lockSelected(): void {
    if (!this.canvas) return;

    const active = this.canvas.getActiveObjects();
    active.forEach((obj) => {
      obj.set({
        selectable: false,
        evented: false,
      });
    });

    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    this.showContextToolbar.set(false);
  }

  public selectAll(): void {
    if (!this.canvas) return;

    const objects = this.canvas
      .getObjects()
      .filter(
        (obj) =>
          !(obj as CustomFabricObject).customData?.isGrid && obj.selectable,
      );

    if (objects.length === 0) return;

    const selection = new fabric.ActiveSelection(objects, {
      canvas: this.canvas,
    });
    this.canvas.setActiveObject(selection);
    this.canvas.requestRenderAll();
  }

  private moveSelected(direction: string, amount: number): void {
    if (!this.canvas) return;

    const active = this.canvas.getActiveObject();
    if (!active) return;

    switch (direction) {
      case "arrowup":
        active.set("top", (active.top || 0) - amount);
        break;
      case "arrowdown":
        active.set("top", (active.top || 0) + amount);
        break;
      case "arrowleft":
        active.set("left", (active.left || 0) - amount);
        break;
      case "arrowright":
        active.set("left", (active.left || 0) + amount);
        break;
    }

    active.setCoords();
    this.canvas.requestRenderAll();
    this.updateContextToolbarPosition();
  }

  // ========== CANVAS ROTATION ==========

  public rotateCanvasLeft(): void {
    const newRotation = (this.canvasRotation() - 90) % 360;
    this.canvasRotation.set(newRotation);
    this.applyCanvasRotation();
  }

  public rotateCanvasRight(): void {
    const newRotation = (this.canvasRotation() + 90) % 360;
    this.canvasRotation.set(newRotation);
    this.applyCanvasRotation();
  }

  private applyCanvasRotation(): void {
    if (!this.canvas) return;

    const center = {
      x: (this.canvas.width || 0) / 2,
      y: (this.canvas.height || 0) / 2,
    };

    // Rotate all objects around center
    const objects = this.canvas
      .getObjects()
      .filter((obj) => !(obj as CustomFabricObject).customData?.isGrid);

    objects.forEach((obj) => {
      const objCenter = obj.getCenterPoint();
      const angle = (90 * Math.PI) / 180; // 90 degrees in radians

      const newX =
        center.x +
        (objCenter.x - center.x) * Math.cos(angle) -
        (objCenter.y - center.y) * Math.sin(angle);
      const newY =
        center.y +
        (objCenter.x - center.x) * Math.sin(angle) +
        (objCenter.y - center.y) * Math.cos(angle);

      obj.set({
        left: newX,
        top: newY,
        angle: (obj.angle || 0) + 90,
      });
      obj.setCoords();
    });

    this.canvas.requestRenderAll();
  }

  // ========== CONTEXT TOOLBAR POSITIONING ==========

  private updateContextToolbarPosition(): void {
    if (!this.canvas) {
      console.log("Context toolbar: no canvas");
      return;
    }

    const active = this.canvas.getActiveObject();
    if (!active) {
      console.log("Context toolbar: no active object");
      this.showContextToolbar.set(false);
      return;
    }

    // getBoundingRect(true) returns coordinates with viewport transform applied
    const bound = active.getBoundingRect();
    const containerEl = this.containerRef()?.nativeElement;

    if (!containerEl) {
      console.log("Context toolbar: no containerEl");
      return;
    }

    // Position above the selection
    let x = bound.left + bound.width / 2 - 80; // Center-ish
    let y = bound.top - 50;

    // Keep within container bounds
    const maxX = containerEl.clientWidth - 200;
    const maxY = containerEl.clientHeight - 50;

    if (x < 10) x = 10;
    if (x > maxX) x = maxX;
    if (y < 10) y = bound.top + bound.height + 10;
    if (y > maxY) y = maxY;

    console.log("Context toolbar: visible at", { x, y, maxY });
    this.contextToolbarPosition.set({ x, y });
    this.showContextToolbar.set(true);
  }

  // ========== PERFORMANCE OPTIMIZATIONS ==========

  public enableObjectCaching(): void {
    if (!this.canvas) return;

    this.canvas.getObjects().forEach((obj) => {
      obj.set({
        objectCaching: true,
        statefullCache: true,
      });
    });
  }

  public disableObjectCaching(): void {
    if (!this.canvas) return;

    this.canvas.getObjects().forEach((obj) => {
      obj.set({
        objectCaching: false,
      });
    });
  }

  // ========== UNDO/REDO SYSTEM ==========

  /**
   * Save current canvas state to history stack
   */
  private saveState(): void {
    if (!this.canvas || this.isRestoring) return;

    const json = JSON.stringify(this.canvas.toJSON());

    // Remove any states after current index (for new branch)
    if (this.historyIndex < this.historyStack.length - 1) {
      this.historyStack.splice(this.historyIndex + 1);
    }

    // Add new state
    this.historyStack.push(json);
    this.historyIndex = this.historyStack.length - 1;

    // Limit history size
    if (this.historyStack.length > this.MAX_HISTORY) {
      this.historyStack.shift();
      this.historyIndex--;
    }

    console.log(
      `State saved (${this.historyIndex + 1}/${this.historyStack.length})`,
    );
  }

  /**
   * Undo last action (Ctrl+Z)
   */
  public undo(): void {
    if (!this.canvas || this.historyIndex <= 0) {
      console.log("Nothing to undo");
      return;
    }

    this.isRestoring = true;
    this.historyIndex--;

    const state = this.historyStack[this.historyIndex];
    this.canvas.loadFromJSON(state).then(() => {
      this.canvas!.requestRenderAll();
      this.isRestoring = false;
      console.log(`Undo to state ${this.historyIndex + 1}`);
    });
  }

  /**
   * Redo action (Ctrl+Y)
   */
  public redo(): void {
    if (!this.canvas || this.historyIndex >= this.historyStack.length - 1) {
      console.log("Nothing to redo");
      return;
    }

    this.isRestoring = true;
    this.historyIndex++;

    const state = this.historyStack[this.historyIndex];
    this.canvas.loadFromJSON(state).then(() => {
      this.canvas!.requestRenderAll();
      this.isRestoring = false;
      console.log(`Redo to state ${this.historyIndex + 1}`);
    });
  }

  // ========== SMALLEST ELEMENT SELECTION (FreeCAD-style) ==========

  /**
   * Check if a point is near an object considering tolerance
   */
  /**
   * Check if a point is near an object considering tolerance
   */
  private isPointNearObject(
    pointer: { x: number; y: number },
    obj: fabric.FabricObject,
    screenTolerance: number = 10,
  ): boolean {
    if (!this.canvas) return false;

    // 1. Coordinate Correction:
    // pointer is in DESIGN coordinates (absolute world space)
    // obj.getBoundingRect() is in SCREEN coordinates (viewport space, affected by zoom/pan)

    // Convert pointer to SCREEN coordinates for bounding box check
    const vpt = this.canvas.viewportTransform;
    if (!vpt) return false;

    const screenPoint = fabric.util.transformPoint(
      new fabric.Point(pointer.x, pointer.y),
      vpt,
    );

    // 2. Quick bounding box check in SCREEN space (stable regardless of zoom)
    const rect = obj.getBoundingRect();
    if (
      screenPoint.x < rect.left - screenTolerance ||
      screenPoint.x > rect.left + rect.width + screenTolerance ||
      screenPoint.y < rect.top - screenTolerance ||
      screenPoint.y > rect.top + rect.height + screenTolerance
    ) {
      return false;
    }

    // 3. Strict containsPoint check (Design space)
    if (obj.containsPoint(new fabric.Point(pointer.x, pointer.y))) {
      return true;
    }

    // 4. Tolerant check (Cross pattern) in DESIGN space
    // We want the tolerance to represent ~10px on screen, so we scale it by zoom
    const zoom = this.canvas.getZoom();
    const designTolerance = screenTolerance / zoom;

    const pointsToCheck = [
      { x: pointer.x - designTolerance, y: pointer.y },
      { x: pointer.x + designTolerance, y: pointer.y },
      { x: pointer.x, y: pointer.y - designTolerance },
      { x: pointer.x, y: pointer.y + designTolerance },
    ];

    return pointsToCheck.some((p) =>
      obj.containsPoint(new fabric.Point(p.x, p.y)),
    );
  }

  /**
   * Find all objects at a point, sorted by bounding box area (smallest first)
   * FIXED: Uses design coordinates consistently
   */
  private findObjectsAtPoint(pointer: {
    x: number;
    y: number;
  }): fabric.FabricObject[] {
    if (!this.canvas) return [];

    const objects: fabric.FabricObject[] = [];
    const zoom = this.canvas.getZoom();
    // Tolerance in design space (equivalent to ~15px on screen)
    const designTolerance = 15 / zoom;

    console.group("🔍 Selection Debug");
    console.log(
      "Design coordinates:",
      pointer,
      "Zoom:",
      zoom,
      "Tolerance:",
      designTolerance,
    );

    let checkedCount = 0;
    let bbPassedCount = 0;

    this.canvas.getObjects().forEach((obj) => {
      // Skip grid lines
      if ((obj as CustomFabricObject).customData?.isGrid) return;

      checkedCount++;

      // Get object bounds in DESIGN space (not affected by viewportTransform)
      const objLeft = obj.left || 0;
      const objTop = obj.top || 0;
      const objWidth = (obj.width || 0) * (obj.scaleX || 1);
      const objHeight = (obj.height || 0) * (obj.scaleY || 1);

      // Bounding box check in DESIGN space
      const inBB =
        pointer.x >= objLeft - designTolerance &&
        pointer.x <= objLeft + objWidth + designTolerance &&
        pointer.y >= objTop - designTolerance &&
        pointer.y <= objTop + objHeight + designTolerance;

      if (!inBB) return;

      bbPassedCount++;

      // containsPoint check (always in design space)
      const containsStrict = obj.containsPoint(
        new fabric.Point(pointer.x, pointer.y),
      );

      // Cross-pattern tolerance check
      const crossPoints = [
        { x: pointer.x - designTolerance, y: pointer.y },
        { x: pointer.x + designTolerance, y: pointer.y },
        { x: pointer.x, y: pointer.y - designTolerance },
        { x: pointer.x, y: pointer.y + designTolerance },
        // Diagonal points for better line coverage
        { x: pointer.x - designTolerance, y: pointer.y - designTolerance },
        { x: pointer.x + designTolerance, y: pointer.y + designTolerance },
        { x: pointer.x - designTolerance, y: pointer.y + designTolerance },
        { x: pointer.x + designTolerance, y: pointer.y - designTolerance },
      ];
      const containsTolerant = crossPoints.some((p) =>
        obj.containsPoint(new fabric.Point(p.x, p.y)),
      );

      // Log objects that pass bounding box
      console.log(
        `✓ ${(obj as CustomFabricObject).customData?.id || obj.type}:`,
        {
          bounds: { left: objLeft, top: objTop, w: objWidth, h: objHeight },
          containsStrict,
          containsTolerant,
        },
      );

      if (containsStrict || containsTolerant) {
        objects.push(obj);
      }
    });

    console.log(
      `Summary: Checked ${checkedCount}, BB passed ${bbPassedCount}, matched ${objects.length}`,
    );
    console.groupEnd();

    // Sort by bounding box area (smallest first = most precise selection)
    objects.sort((a, b) => {
      const aW = (a.width || 0) * (a.scaleX || 1);
      const aH = (a.height || 0) * (a.scaleY || 1);
      const bW = (b.width || 0) * (b.scaleX || 1);
      const bH = (b.height || 0) * (b.scaleY || 1);
      return aW * aH - bW * bH;
    });

    return objects;
  }

  /**
   * Select the smallest object at click point
   * On repeated clicks at same position, cycle through overlapping objects
   */
  public selectSmallestAtPoint(pointer: { x: number; y: number }): void {
    if (!this.canvas) return;

    const zoom = this.canvas.getZoom();
    const POSITION_THRESHOLD = 5 / zoom; // Design-space threshold

    // Check if clicking at same position
    const samePosition =
      this.lastClickPos &&
      Math.abs(pointer.x - this.lastClickPos.x) < POSITION_THRESHOLD &&
      Math.abs(pointer.y - this.lastClickPos.y) < POSITION_THRESHOLD;

    if (samePosition && this.overlappingObjects.length > 1) {
      // Cycle to next object
      this.currentOverlapIndex =
        (this.currentOverlapIndex + 1) % this.overlappingObjects.length;
      const nextObj = this.overlappingObjects[this.currentOverlapIndex];
      this.canvas.setActiveObject(nextObj);
      this.canvas.requestRenderAll();
      console.log(
        `Selection cycle: ${this.currentOverlapIndex + 1}/${this.overlappingObjects.length}`,
      );
    } else {
      // New click position - find all objects
      this.overlappingObjects = this.findObjectsAtPoint(pointer);
      this.currentOverlapIndex = 0;
      this.lastClickPos = { ...pointer };

      // VISUAL DEBUG: Add a temporary marker to show where the click was registered
      const debugDot = new fabric.Circle({
        left: pointer.x - 3,
        top: pointer.y - 3,
        radius: 3,
        fill: "red",
        selectable: false,
        evented: false,
        opacity: 0.7,
      });
      this.canvas.add(debugDot);
      setTimeout(() => {
        this.canvas?.remove(debugDot);
        this.canvas?.requestRenderAll();
      }, 500);

      if (this.overlappingObjects.length > 0) {
        // Select the smallest (first in sorted array)
        this.canvas.setActiveObject(this.overlappingObjects[0]);
        this.canvas.requestRenderAll();
        console.log(
          `Selected smallest of ${this.overlappingObjects.length} objects`,
        );
      } else {
        console.log("No objects found at click point.");
        // If we missed everything with our custom logic, let Fabric try its default
        // by NOT stopping propagation if we were to handle events strictly.
      }
    }
  }
}
