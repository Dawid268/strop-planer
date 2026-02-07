import { Injectable, inject } from "@angular/core";
import { fabric } from "fabric";
import { EditorStore } from "@stores/editor.store";
import {
  CustomFabricObject,
  CANVAS_COLORS,
  CanvasPoint,
} from "@utils/canvas.utils";
import { CanvasStateService } from "./canvas-state.service";

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

  // Slab drawing state
  public isDrawingSlab = false;
  public slabPoints: CanvasPoint[] = [];
  private slabPreviewLine: fabric.Line | null = null;
  private slabMarkers: fabric.Circle[] = [];
  private slabLines: fabric.Line[] = [];

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
      layer: this.store.activeLayerId() ?? undefined,
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
      if (dist < 30) {
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
      layer: this.store.activeLayerId() ?? undefined,
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
    this.dimensionText.bringToFront();
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
      layer: this.store.activeLayerId() ?? undefined,
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
      layer: this.store.activeLayerId() ?? undefined,
    });
    this.stateService.updateObjectCount(canvas);
    canvas.requestRenderAll();
  }

  // --- Slab Drawing (Manual) ---

  public startSlabDrawing(canvas: fabric.Canvas): void {
    this.isDrawingSlab = true;
    this.slabPoints = [];
    this.clearSlabPreviews(canvas);
  }

  public addSlabPoint(canvas: fabric.Canvas, pointer: CanvasPoint): boolean {
    const finalPoint = { ...pointer };
    this.slabPoints.push(finalPoint);

    // Marker for the vertex
    const marker = new fabric.Circle({
      left: finalPoint.x,
      top: finalPoint.y,
      radius: 5,
      fill: "#fb8c00", // Yellow/Orange as per UI design
      stroke: "#ef6c00",
      strokeWidth: 2,
      originX: "center",
      originY: "center",
      selectable: false,
      evented: false,
    });
    this.slabMarkers.push(marker);
    canvas.add(marker);

    // Permanent segment
    if (this.slabPoints.length > 1) {
      const prev = this.slabPoints[this.slabPoints.length - 2];
      const segment = new fabric.Line(
        [prev.x, prev.y, finalPoint.x, finalPoint.y],
        {
          stroke: "#fb8c00",
          strokeWidth: 2,
          selectable: false,
          evented: false,
        },
      );
      this.slabLines.push(segment);
      canvas.add(segment);
    }

    // Check for closing (click on first point)
    if (this.slabPoints.length >= 3) {
      const first = this.slabPoints[0];
      const dist = Math.sqrt(
        Math.pow(finalPoint.x - first.x, 2) +
          Math.pow(finalPoint.y - first.y, 2),
      );

      // Closing tolerance: 20 units
      if (dist < 20) {
        this.finishSlab(canvas);
        return true;
      }
    }

    return false;
  }

  public updateSlabPreview(canvas: fabric.Canvas, pointer: CanvasPoint): void {
    if (this.slabPoints.length === 0) return;

    if (this.slabPreviewLine) {
      canvas.remove(this.slabPreviewLine);
    }

    const lastPoint = this.slabPoints[this.slabPoints.length - 1];

    // Check if near start point for closing indicator
    const firstPoint = this.slabPoints[0];
    const distToStart = Math.sqrt(
      Math.pow(pointer.x - firstPoint.x, 2) +
        Math.pow(pointer.y - firstPoint.y, 2),
    );

    this.slabPreviewLine = new fabric.Line(
      [lastPoint.x, lastPoint.y, pointer.x, pointer.y],
      {
        stroke: distToStart < 20 ? "#4caf50" : "#fb8c00", // Green if closing
        strokeWidth: 2,
        strokeDashArray: [5, 5],
        selectable: false,
        evented: false,
      },
    );
    canvas.add(this.slabPreviewLine);

    // Vertex Label (Distance)
    this.updateDimensionLabel(canvas, lastPoint, pointer);

    canvas.requestRenderAll();
  }

  public removeLastSlabPoint(canvas: fabric.Canvas): void {
    if (this.slabPoints.length === 0) return;

    this.slabPoints.pop();

    const marker = this.slabMarkers.pop();
    if (marker) canvas.remove(marker);

    const line = this.slabLines.pop();
    if (line) canvas.remove(line);

    if (this.slabPreviewLine) canvas.remove(this.slabPreviewLine);

    if (this.slabPoints.length > 0) {
      // Preview will be updated on next mouse move
    } else {
      if (this.dimensionText) this.dimensionText.visible = false;
    }

    canvas.requestRenderAll();
  }

  public finishSlab(canvas: fabric.Canvas): void {
    if (this.slabPoints.length < 3) return;

    // Use at least 3 points, if the last point was just a duplication of the first (closing click), pop it
    const pointsToUse = [...this.slabPoints];
    const first = pointsToUse[0];
    const last = pointsToUse[pointsToUse.length - 1];
    if (
      Math.sqrt(Math.pow(last.x - first.x, 2) + Math.pow(last.y - first.y, 2)) <
      20
    ) {
      pointsToUse.pop();
    }

    if (pointsToUse.length < 3) return;

    this.clearSlabPreviews(canvas);
    this.store.createSlabFromPoints(pointsToUse);

    this.isDrawingSlab = false;
    this.slabPoints = [];
    canvas.requestRenderAll();
  }

  public clearSlabPreviews(canvas: fabric.Canvas): void {
    if (this.slabPreviewLine) {
      canvas.remove(this.slabPreviewLine);
      this.slabPreviewLine = null;
    }
    this.slabMarkers.forEach((m) => canvas.remove(m));
    this.slabMarkers = [];
    this.slabLines.forEach((l) => canvas.remove(l));
    this.slabLines = [];
    if (this.dimensionText) this.dimensionText.visible = false;
  }
}
