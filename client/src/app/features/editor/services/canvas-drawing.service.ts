import { Injectable, inject } from "@angular/core";
import * as fabric from "fabric";
import { EditorStore } from "../store/editor.store";
import {
  CustomFabricObject,
  CANVAS_COLORS,
  CanvasPoint,
} from "../utils/canvas.utils";
import { CanvasStateService } from "./canvas-state.service";
import { MessageService } from "primeng/api";

@Injectable()
export class CanvasDrawingService {
  private readonly store = inject(EditorStore);
  private readonly stateService = inject(CanvasStateService);

  // Drawing state
  public isDrawingBeam = false;
  private beamStartPoint: CanvasPoint | null = null;
  private currentBeamLine: fabric.Line | null = null;

  public polygonPoints: CanvasPoint[] = [];
  private polygonPreviewLine: fabric.Line | null = null;
  private polygonMarkers: fabric.Circle[] = [];
  private polygonLines: fabric.Line[] = [];
  private dimensionText: fabric.Text | null = null;

  public startBeam(canvas: fabric.Canvas, pointer: CanvasPoint): void {
    this.isDrawingBeam = true;
    this.beamStartPoint = { x: pointer.x, y: pointer.y };
    this.currentBeamLine = new fabric.Line(
      [pointer.x, pointer.y, pointer.x, pointer.y],
      {
        stroke: CANVAS_COLORS.BEAM,
        strokeWidth: 3,
        strokeLineCap: "round",
        selectable: false,
        evented: false,
      },
    );
    canvas.add(this.currentBeamLine);
  }

  public updateBeamPreview(canvas: fabric.Canvas, pointer: CanvasPoint): void {
    if (this.currentBeamLine) {
      this.currentBeamLine.set({ x2: pointer.x, y2: pointer.y });
      canvas.requestRenderAll();
    }
  }

  public finishBeam(canvas: fabric.Canvas, pointer: CanvasPoint): void {
    if (!this.beamStartPoint) return;

    if (this.currentBeamLine) {
      canvas.remove(this.currentBeamLine);
    }

    const beam = new fabric.Line(
      [this.beamStartPoint.x, this.beamStartPoint.y, pointer.x, pointer.y],
      {
        stroke: CANVAS_COLORS.BEAM,
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
    canvas.add(beam);

    this.store.addShape({
      id: (beam as CustomFabricObject).customData!.id!,
      type: "beam",
      x: beam.left || 0,
      y: beam.top || 0,
      rotation: beam.angle || 0,
      layer: this.store.activeLayerId(),
    });

    this.isDrawingBeam = false;
    this.beamStartPoint = null;
    this.currentBeamLine = null;
    this.stateService.updateObjectCount(canvas);
    canvas.requestRenderAll();
  }

  public addPolygonPoint(
    canvas: fabric.Canvas,
    pointer: CanvasPoint,
    isTrace = false,
  ): boolean {
    const finalPoint = pointer; // Snapping handled by InteractionService calling this
    this.polygonPoints.push(finalPoint);

    const marker = new fabric.Circle({
      left: finalPoint.x - 5,
      top: finalPoint.y - 5,
      radius: 5,
      fill: isTrace
        ? CANVAS_COLORS.TRACE_MARKER_FILL
        : CANVAS_COLORS.POLYGON_STROKE,
      stroke: isTrace ? CANVAS_COLORS.TRACE_MARKER_STROKE : "#1565c0",
      strokeWidth: 2,
      selectable: false,
      evented: false,
    });
    this.polygonMarkers.push(marker);
    canvas.add(marker);

    if (this.polygonPoints.length > 1) {
      const prev = this.polygonPoints[this.polygonPoints.length - 2];
      const segment = new fabric.Line(
        [prev.x, prev.y, finalPoint.x, finalPoint.y],
        {
          stroke: isTrace
            ? CANVAS_COLORS.TRACE_MARKER_FILL
            : CANVAS_COLORS.POLYGON_STROKE,
          strokeWidth: 2,
          selectable: false,
          evented: false,
        },
      );
      this.polygonLines.push(segment);
      canvas.add(segment);
    }

    // Check for closing
    if (this.polygonPoints.length >= 3) {
      const first = this.polygonPoints[0];
      const dist = Math.sqrt(
        Math.pow(finalPoint.x - first.x, 2) +
          Math.pow(finalPoint.y - first.y, 2),
      );
      if (dist < 20) {
        this.finishPolygon(canvas);
        return true;
      }
    }
    return false;
  }

  public updatePolygonPreview(
    canvas: fabric.Canvas,
    pointer: CanvasPoint,
    isTrace = false,
  ): void {
    if (this.polygonPoints.length === 0) return;

    if (this.polygonPreviewLine) {
      canvas.remove(this.polygonPreviewLine);
    }
    const lastPoint = this.polygonPoints[this.polygonPoints.length - 1];
    this.polygonPreviewLine = new fabric.Line(
      [lastPoint.x, lastPoint.y, pointer.x, pointer.y],
      {
        stroke: isTrace
          ? CANVAS_COLORS.TRACE_MARKER_FILL
          : CANVAS_COLORS.POLYGON_STROKE,
        strokeWidth: 2,
        strokeDashArray: [5, 5],
        selectable: false,
        evented: false,
      },
    );
    canvas.add(this.polygonPreviewLine);
    this.updateDimensionLabel(canvas, lastPoint, pointer);
    canvas.requestRenderAll();
  }

  public finishPolygon(canvas: fabric.Canvas): void {
    if (this.polygonPoints.length < 3) return;

    this.clearDrawingPreviews(canvas);

    const polygon = new fabric.Polygon(this.polygonPoints, {
      fill: CANVAS_COLORS.POLYGON_FILL,
      stroke: CANVAS_COLORS.POLYGON_STROKE,
      strokeWidth: 2,
      selectable: true,
      evented: true,
    });
    const id = `polygon-${Date.now()}`;
    (polygon as CustomFabricObject).customData = { id, type: "slab" };
    canvas.add(polygon);

    this.store.addShape({
      id,
      type: "slab",
      x: polygon.left || 0,
      y: polygon.top || 0,
      points: [...this.polygonPoints],
      layer: this.store.activeLayerId(),
    });

    this.polygonPoints = [];
    this.stateService.updateObjectCount(canvas);
    canvas.requestRenderAll();
  }

  public clearDrawingPreviews(canvas: fabric.Canvas): void {
    if (this.polygonPreviewLine) {
      canvas.remove(this.polygonPreviewLine);
      this.polygonPreviewLine = null;
    }
    this.polygonMarkers.forEach((m) => canvas.remove(m));
    this.polygonMarkers = [];
    this.polygonLines.forEach((l) => canvas.remove(l));
    this.polygonLines = [];
    if (this.dimensionText) this.dimensionText.visible = false;
    this.isDrawingBeam = false;
    if (this.currentBeamLine) canvas.remove(this.currentBeamLine);
  }

  private updateDimensionLabel(
    canvas: fabric.Canvas,
    p1: CanvasPoint,
    p2: CanvasPoint,
  ): void {
    const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    const text = `${(dist / 1000).toFixed(2)} m`;

    if (!this.dimensionText) {
      this.dimensionText = new fabric.Text(text, {
        fontSize: 14,
        fontFamily: "Arial",
        fill: "#ffffff",
        backgroundColor: "#000000",
        selectable: false,
        evented: false,
        originX: "center",
        originY: "bottom",
      });
      canvas.add(this.dimensionText);
    }

    this.dimensionText.set({
      text,
      left: (p1.x + p2.x) / 2,
      top: (p1.y + p2.y) / 2 - 10,
      visible: true,
    });
    canvas.bringObjectToFront(this.dimensionText);
  }

  public addPanelAtPoint(canvas: fabric.Canvas, x: number, y: number): void {
    const catalogItem = this.store.activeCatalogItem();
    const width = catalogItem?.width || 120;
    const height = catalogItem?.length || 60;

    const panel = new fabric.Rect({
      left: x - width / 2,
      top: y - height / 2,
      width,
      height,
      fill: CANVAS_COLORS.PANEL_FILL,
      stroke: CANVAS_COLORS.PANEL_STROKE,
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
    canvas.add(panel);

    this.store.addShape({
      id: (panel as CustomFabricObject).customData!.id!,
      type: "panel",
      x: panel.left || 0,
      y: panel.top || 0,
      width: panel.width,
      height: panel.height,
      rotation: panel.angle || 0,
      layer: this.store.activeLayerId(),
      catalogCode: catalogItem?.code,
    });
    this.stateService.updateObjectCount(canvas);
    canvas.requestRenderAll();
  }

  public addPropAtPoint(canvas: fabric.Canvas, x: number, y: number): void {
    const prop = new fabric.Circle({
      left: x - 15,
      top: y - 15,
      radius: 15,
      fill: CANVAS_COLORS.PROP_FILL,
      stroke: CANVAS_COLORS.PROP_STROKE,
      strokeWidth: 2,
      selectable: true,
      evented: true,
    });
    (prop as CustomFabricObject).customData = {
      id: `prop-${Date.now()}`,
      type: "prop",
    };
    canvas.add(prop);

    this.store.addShape({
      id: (prop as CustomFabricObject).customData!.id!,
      type: "prop",
      x: prop.left || 0,
      y: prop.top || 0,
      rotation: prop.angle || 0,
      layer: this.store.activeLayerId(),
    });
    this.stateService.updateObjectCount(canvas);
    canvas.requestRenderAll();
  }
}
