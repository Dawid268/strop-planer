import { Injectable, signal, inject, NgZone } from "@angular/core";
import { fabric } from "fabric";
import { CanvasDrawingService } from "./canvas-drawing.service";
import { CanvasInteractionService } from "./canvas-interaction.service";
import { CanvasSelectionService } from "./canvas-selection.service";
import { ViewportService } from "./viewport.service";
import type { EditorTool } from "@models/editor.models";

export interface EventHandlerCallbacks {
  getActiveTool: () => EditorTool;
  getActiveLayer: () => { isLocked: boolean; type: string } | null;
  onSelectionChanged: (ids: string[]) => void;
  onShapeModified: (
    id: string,
    changes: { x: number; y: number; rotation: number },
  ) => void;
  onClearSelection: () => void;
  findNearestSnapPoint: (
    point: { x: number; y: number },
    threshold: number,
  ) => { x: number; y: number } | null;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  saveHistoryState: () => void;
  onAutoSlabTrigger: (pointer: { x: number; y: number }) => void;
}

/**
 * Service that manages canvas event handling.
 * Centralizes mouse events, selection events, and object events.
 */
@Injectable()
export class CanvasEventHandlerService {
  private readonly ngZone = inject(NgZone);
  private readonly drawing = inject(CanvasDrawingService);
  private readonly interaction = inject(CanvasInteractionService);
  private readonly selection = inject(CanvasSelectionService);
  private readonly viewport = inject(ViewportService);

  /** Whether panning is currently active */
  public readonly isPanning = signal(false);

  private canvas: fabric.Canvas | null = null;
  private callbacks: EventHandlerCallbacks | null = null;
  private lastPanPos = { x: 0, y: 0 };
  private viewUnsubscribe: (() => void) | null = null;
  private zoomEndTimeout: ReturnType<typeof setTimeout> | null = null;
  private storeUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
  private containerElement: HTMLElement | null = null;

  /**
   * Initializes the event handler service with canvas and callbacks.
   */
  public init(
    canvas: fabric.Canvas,
    container: HTMLElement,
    callbacks: EventHandlerCallbacks,
  ): void {
    this.canvas = canvas;
    this.containerElement = container;
    this.callbacks = callbacks;
    this.setupEventHandlers();
  }

  /**
   * Cleans up event handlers and subscriptions.
   */
  public destroy(): void {
    this.viewUnsubscribe?.();
    this.viewUnsubscribe = null;
    if (this.zoomEndTimeout) clearTimeout(this.zoomEndTimeout);
    if (this.storeUpdateTimeout) clearTimeout(this.storeUpdateTimeout);
    this.canvas = null;
    this.callbacks = null;
    this.containerElement = null;
  }

  private setupEventHandlers(): void {
    if (!this.canvas || !this.callbacks) return;

    this.setupSelectionEvents();
    this.setupObjectEvents();
    this.setupMouseWheelEvent();
    this.setupViewportSync();
    this.setupMouseEvents();
    this.setupKeyboardEvents();
  }

  private setupSelectionEvents(): void {
    if (!this.canvas || !this.callbacks) return;

    this.canvas.on("selection:created", () => this.handleSelection());
    this.canvas.on("selection:updated", () => this.handleSelection());
    this.canvas.on("selection:cleared", () => {
      this.callbacks?.onClearSelection();
      this.interaction.showContextToolbar.set(false);
    });
  }

  private setupObjectEvents(): void {
    if (!this.canvas || !this.callbacks) return;

    this.canvas.on("object:modified", (e) => {
      const obj = (e as { target?: fabric.Object }).target;
      const customData = (
        obj as fabric.Object & { customData?: { id: string } }
      )?.customData;
      if (customData?.id) {
        this.callbacks?.onShapeModified(customData.id, {
          x: obj?.left ?? 0,
          y: obj?.top ?? 0,
          rotation: obj?.angle ?? 0,
        });
      }
      this.callbacks?.saveHistoryState();
    });
  }

  private setupMouseWheelEvent(): void {
    if (!this.canvas) return;

    this.canvas.on("mouse:wheel", (opt) => {
      const e = (opt as { e: WheelEvent }).e;
      e.preventDefault();
      e.stopPropagation();

      // Disable target finding during rapid zoom
      (
        this.canvas as fabric.Canvas & { skipTargetFind?: boolean }
      ).skipTargetFind = true;

      const currentZoom = this.viewport.zoom();
      const rect = this.canvas!.getElement().getBoundingClientRect();
      const screenPoint = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      const zoomIntensity = 0.12;
      const factor = e.deltaY > 0 ? 1 / (1 + zoomIntensity) : 1 + zoomIntensity;
      const newZoom = currentZoom * factor;

      this.viewport.setZoom(newZoom, screenPoint);

      // Restore target finding after delay
      if (this.zoomEndTimeout) clearTimeout(this.zoomEndTimeout);
      this.zoomEndTimeout = setTimeout(() => {
        if (this.canvas) {
          (
            this.canvas as fabric.Canvas & { skipTargetFind?: boolean }
          ).skipTargetFind = false;
        }
      }, 100);
    });
  }

  private setupViewportSync(): void {
    this.viewUnsubscribe = this.viewport.onViewChange((zoom, x, y) => {
      if (!this.canvas) return;

      const vpt = this.canvas.viewportTransform;
      if (vpt) {
        vpt[0] = zoom;
        vpt[3] = zoom;
        vpt[4] = x;
        vpt[5] = y;
        this.canvas.requestRenderAll();
      }

      // Throttled store update
      if (!this.storeUpdateTimeout) {
        this.storeUpdateTimeout = setTimeout(() => {
          this.ngZone.run(() => {
            this.callbacks?.setZoom(zoom);
            this.callbacks?.setPan(x, y);
          });
          this.storeUpdateTimeout = null;
        }, 200);
      }
    });
  }

  private setupMouseEvents(): void {
    if (!this.canvas || !this.callbacks) return;

    this.canvas.on("mouse:down", (opt) => {
      this.handleMouseDown(opt as { e: Event });
    });

    this.canvas.on("mouse:move", (opt) => {
      this.handleMouseMove(opt as { e: Event });
    });

    this.canvas.on("mouse:up", (opt) => {
      this.handleMouseUp(opt as { e: Event });
    });

    this.canvas.on("mouse:dblclick", () => {
      if (this.callbacks?.getActiveTool() === "draw-polygon") {
        this.drawing.finishPolygon(this.canvas!);
      }
    });
  }

  private handleMouseDown(opt: { e: Event }): void {
    if (!this.canvas || !this.callbacks) return;

    const e = opt.e as MouseEvent;
    const pointer = this.canvas.getPointer(e);
    const tool = this.callbacks.getActiveTool();

    const isMiddleClick = e.button === 1;
    const isPanningTool = tool === "pan" || e.altKey || isMiddleClick;
    const activeLayer = this.callbacks.getActiveLayer();
    const isDrawingOrPlacing = tool !== "select" && tool !== "pan";

    if (
      !isPanningTool &&
      isDrawingOrPlacing &&
      (activeLayer?.isLocked || activeLayer?.type === "cad")
    ) {
      return;
    }

    if (isPanningTool) {
      this.startPanning(e.clientX, e.clientY);
      return;
    }

    switch (tool) {
      case "draw-beam":
        this.drawing.startBeam(this.canvas, pointer);
        break;
      case "trace-slab": {
        const snapped = this.callbacks.findNearestSnapPoint(pointer, 25);
        this.drawing.addPolygonPoint(this.canvas, snapped ?? pointer, true);
        break;
      }
      case "draw-slab-manual": {
        const snapped = this.callbacks.findNearestSnapPoint(pointer, 20);
        this.drawing.addSlabPoint(this.canvas, snapped ?? pointer);
        break;
      }
      case "trace-slab-auto": {
        // Automatic detection logic
        this.handleAutoSlabDetection(pointer);
        break;
      }
      case "draw-polygon":
        this.drawing.addPolygonPoint(this.canvas, pointer);
        break;
      case "add-panel":
        this.drawing.addPanelAtPoint(this.canvas, pointer.x, pointer.y);
        break;
      case "add-prop":
        this.drawing.addPropAtPoint(this.canvas, pointer.x, pointer.y);
        break;
      case "select":
        this.handleSelectToolMouseDown(pointer);
        break;
      default: {
        const targets = this.interaction.findObjectsAtPoint(
          this.canvas,
          pointer,
        );
        if (targets.length === 0) {
          this.canvas.discardActiveObject();
        }
        break;
      }
    }
  }

  private handleSelectToolMouseDown(pointer: { x: number; y: number }): void {
    if (!this.canvas) return;

    const targets = this.interaction.findObjectsAtPoint(this.canvas, pointer);
    if (targets.length > 0) {
      this.selection.clearMarquee();
      this.ngZone.runOutsideAngular(() => {
        this.interaction.selectSmallestAtPoint(this.canvas!, pointer);
      });
    } else {
      this.selection.startMarquee(pointer);
      const canvasAny = this.canvas as unknown as {
        _groupSelector?: { ex: number; ey: number; top: number; left: number };
      };
      canvasAny._groupSelector = {
        ex: pointer.x,
        ey: pointer.y,
        top: 0,
        left: 0,
      };
    }
  }

  private handleMouseMove(opt: { e: Event }): void {
    if (!this.canvas || !this.callbacks) return;

    const e = opt.e as MouseEvent;
    const pointer = this.canvas.getPointer(opt.e);
    const tool = this.callbacks.getActiveTool();

    if (this.isPanning()) {
      const deltaX = e.clientX - this.lastPanPos.x;
      const deltaY = e.clientY - this.lastPanPos.y;
      this.lastPanPos = { x: e.clientX, y: e.clientY };
      this.viewport.panBy(deltaX, deltaY);
      return;
    }

    if (tool === "draw-beam" && this.drawing.isDrawingBeam) {
      this.drawing.updateBeamPreview(this.canvas, pointer);
    } else if (tool === "trace-slab") {
      const snapped = this.callbacks.findNearestSnapPoint(pointer, 25);
      this.interaction.updateSnapGuide(this.canvas, snapped);
      this.drawing.updatePolygonPreview(this.canvas, snapped ?? pointer, true);
    } else if (tool === "draw-slab-manual") {
      const snapped = this.callbacks.findNearestSnapPoint(pointer, 20);
      this.interaction.updateSnapGuide(this.canvas, snapped);
      this.drawing.updateSlabPreview(this.canvas, snapped ?? pointer);
    } else if (tool === "draw-polygon") {
      this.drawing.updatePolygonPreview(this.canvas, pointer);
    }
  }

  private handleMouseUp(opt: { e: Event }): void {
    if (!this.canvas || !this.callbacks) return;

    if (this.isPanning()) {
      this.stopPanning();
      return;
    }

    if (
      this.callbacks.getActiveTool() === "draw-beam" &&
      this.drawing.isDrawingBeam
    ) {
      this.drawing.finishBeam(this.canvas, this.canvas.getPointer(opt.e));
      return;
    }

    const marqueeStart = this.selection.marqueeStart();
    if (this.callbacks.getActiveTool() === "select" && marqueeStart !== null) {
      const upPointer = this.canvas.getPointer(opt.e);

      if (!this.selection.isMarqueeDrag(marqueeStart, upPointer)) {
        this.canvas.discardActiveObject();
        this.callbacks.onClearSelection();
        this.interaction.showContextToolbar.set(false);
        this.canvas.requestRenderAll();
      } else {
        const collected = this.selection.findObjectsInRect(this.canvas, {
          x1: marqueeStart.x,
          y1: marqueeStart.y,
          x2: upPointer.x,
          y2: upPointer.y,
        });
        this.selection.applySelection(this.canvas, collected);
        this.handleSelection();
      }
      this.selection.clearMarquee();
    }
  }

  private startPanning(clientX: number, clientY: number): void {
    this.isPanning.set(true);
    this.lastPanPos = { x: clientX, y: clientY };
    if (this.canvas) {
      this.canvas.selection = false;
      (
        this.canvas as fabric.Canvas & { skipTargetFind?: boolean }
      ).skipTargetFind = true;
    }
    this.containerElement?.classList.add("panning");
  }

  private stopPanning(): void {
    this.isPanning.set(false);
    if (this.canvas) {
      (
        this.canvas as fabric.Canvas & { skipTargetFind?: boolean }
      ).skipTargetFind = false;
      this.canvas.selection = this.callbacks?.getActiveTool() === "select";
    }
    this.containerElement?.classList.remove("panning");
  }

  private handleAutoSlabDetection(pointer: { x: number; y: number }): void {
    this.callbacks?.onAutoSlabTrigger(pointer);
  }

  private setupKeyboardEvents(): void {
    window.addEventListener("keydown", (e) => {
      const tool = this.callbacks?.getActiveTool();
      if (tool === "draw-slab-manual") {
        if (e.key === "Backspace") {
          this.drawing.removeLastSlabPoint(this.canvas!);
        } else if (e.key === "Enter") {
          this.drawing.finishSlab(this.canvas!);
        }
      }
    });
  }

  private handleSelection(): void {
    if (!this.canvas || !this.callbacks) return;

    const ids = this.selection.getSelectedIds(this.canvas);
    this.callbacks.onSelectionChanged(ids);

    setTimeout(() => {
      if (this.canvas && this.containerElement) {
        this.interaction.updateContextToolbarPosition(
          this.canvas,
          this.containerElement,
        );
      }
    }, 10);
  }
}
