import { Injectable, signal } from "@angular/core";
import { fabric } from "fabric";
import {
  CustomFabricObject,
  CANVAS_COLORS,
  CanvasPoint,
} from "@utils/canvas.utils";

@Injectable()
export class CanvasInteractionService {
  public readonly showContextToolbar = signal(false);
  public readonly contextToolbarPosition = signal<{
    x: number;
    y: number;
  } | null>(null);
  public readonly selectedObjectType = signal<string | null>(null);

  private lastClickPos: CanvasPoint | null = null;
  private overlappingObjects: fabric.FabricObject[] = [];
  private currentOverlapIndex = 0;
  private snapGuide: fabric.Circle | null = null;

  public updateContextToolbarPosition(
    canvas: fabric.Canvas,
    container: HTMLElement,
  ): void {
    // #region agent log
    fetch("http://127.0.0.1:7247/ingest/7133446a-8894-439e-aca5-19c6ad6230f6",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({location:"canvas-interaction.service.ts:27",message:"update_context_toolbar",data:{hasActive:!!canvas.getActiveObject(),containerExists:!!container,containerWidth:container?.clientWidth,containerHeight:container?.clientHeight},timestamp:Date.now(),sessionId:"debug-session",runId:"pre-fix",hypothesisId:"H5"})}).catch(()=>{});
    // #endregion
    const active = canvas.getActiveObject();
    if (!active) {
      this.showContextToolbar.set(false);
      this.selectedObjectType.set(null);
      return;
    }

    if (active.type === "activeSelection") {
      this.selectedObjectType.set("multiple");
    } else {
      const customData = (active as CustomFabricObject).customData;
      this.selectedObjectType.set(customData?.type || active.type || null);
    }

    const bound = active.getBoundingRect();
    let x = bound.left + bound.width / 2 - 80;
    let y = bound.top - 50;

    const maxX = container.clientWidth - 200;
    const maxY = container.clientHeight - 50;

    if (x < 10) x = 10;
    if (x > maxX) x = maxX;
    if (y < 10) y = bound.top + bound.height + 10;
    if (y > maxY) y = maxY;

    this.contextToolbarPosition.set({ x, y });
    this.showContextToolbar.set(true);
  }

  public updateSnapGuide(
    canvas: fabric.Canvas,
    point: CanvasPoint | null,
  ): void {
    if (!point) {
      if (this.snapGuide) {
        this.snapGuide.set({ visible: false });
        canvas.requestRenderAll();
      }
      return;
    }

    if (!this.snapGuide) {
      this.snapGuide = new fabric.Circle({
        radius: 6,
        fill: "transparent",
        stroke: CANVAS_COLORS.SNAP_GUIDE,
        strokeWidth: 2,
        selectable: false,
        evented: false,
        originX: "center",
        originY: "center",
      });
      canvas.add(this.snapGuide);
    }

    this.snapGuide.set({ left: point.x, top: point.y, visible: true });
    this.snapGuide.bringToFront();
    canvas.requestRenderAll();
  }

  public findObjectsAtPoint(
    canvas: fabric.Canvas,
    pointer: CanvasPoint,
  ): fabric.FabricObject[] {
    const objects: fabric.FabricObject[] = [];
    const zoom = canvas.getZoom();
    const hitTolerance = Math.max(5, 15 / zoom);

    const allObjects = canvas.getObjects();

    for (const obj of allObjects) {
      const customData = (obj as CustomFabricObject).customData;
      if (customData?.isGrid) continue;

      // PERFORMANCE: Use absolute world-space bounding box check.
      const bound = obj.getBoundingRect(true);

      if (
        pointer.x < bound.left - hitTolerance ||
        pointer.x > bound.left + bound.width + hitTolerance ||
        pointer.y < bound.top - hitTolerance ||
        pointer.y > bound.top + bound.height + hitTolerance
      ) {
        continue;
      }

      // Precise hit testing
      if (this.isObjectHit(obj as fabric.Object, pointer, hitTolerance)) {
        objects.push(obj as fabric.Object);
      }
    }

    // Sort to prioritize:
    // 1. Smaller objects (Area)
    // 2. Lines / CAD entities
    // 3. Distance from point
    objects.sort((a: fabric.FabricObject, b: fabric.FabricObject) => {
      const aCustom = a as CustomFabricObject;
      const bCustom = b as CustomFabricObject;
      const aData = aCustom.customData || {};
      const bData = bCustom.customData || {};

      const getArea = (obj: fabric.FabricObject): number => {
        const customObj = obj as CustomFabricObject;
        if (obj.type === "line" || customObj.customData?.type === "line")
          return 0;
        const rect = obj.getBoundingRect(true);
        return rect.width * rect.height;
      };

      const aArea = getArea(a);
      const bArea = getArea(b);

      if (Math.abs(aArea - bArea) > 5) {
        // Use larger threshold for area diff
        return aArea - bArea;
      }

      let aDist = Infinity;
      let bDist = Infinity;

      if (a.type === "line" || aData.type === "line") {
        const aLine = a as fabric.Line;
        const x1 = aData.x1 !== undefined ? aData.x1 : (aLine.x1 ?? 0);
        const y1 = aData.y1 !== undefined ? aData.y1 : (aLine.y1 ?? 0);
        const x2 = aData.x2 !== undefined ? aData.x2 : (aLine.x2 ?? 0);
        const y2 = aData.y2 !== undefined ? aData.y2 : (aLine.y2 ?? 0);
        aDist = this.pointToLineDistance(pointer.x, pointer.y, x1, y1, x2, y2);
      } else {
        const center = a.getCenterPoint();
        aDist = Math.sqrt(
          (center.x - pointer.x) ** 2 + (center.y - pointer.y) ** 2,
        );
      }

      if (b.type === "line" || bData.type === "line") {
        const bLine = b as fabric.Line;
        const x1 = bData.x1 !== undefined ? bData.x1 : (bLine.x1 ?? 0);
        const y1 = bData.y1 !== undefined ? bData.y1 : (bLine.y1 ?? 0);
        const x2 = bData.x2 !== undefined ? bData.x2 : (bLine.x2 ?? 0);
        const y2 = bData.y2 !== undefined ? bData.y2 : (bLine.y2 ?? 0);
        bDist = this.pointToLineDistance(pointer.x, pointer.y, x1, y1, x2, y2);
      } else {
        const center = b.getCenterPoint();
        bDist = Math.sqrt(
          (center.x - pointer.x) ** 2 + (center.y - pointer.y) ** 2,
        );
      }

      return aDist - bDist;
    });

    return objects;
  }

  private pointToLineDistance(
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) {
      return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
    }

    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));

    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;

    return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
  }

  public selectSmallestAtPoint(
    canvas: fabric.Canvas,
    pointer: CanvasPoint,
  ): void {
    const zoom = canvas.getZoom();
    // Use an even larger pixel-based threshold for cycling (20px on screen)
    const cyclingThreshold = 20 / zoom;

    const samePosition =
      this.lastClickPos &&
      Math.abs(pointer.x - this.lastClickPos.x) < cyclingThreshold &&
      Math.abs(pointer.y - this.lastClickPos.y) < cyclingThreshold;

    if (samePosition && this.overlappingObjects.length > 1) {
      this.currentOverlapIndex =
        (this.currentOverlapIndex + 1) % this.overlappingObjects.length;
      const obj = this.overlappingObjects[this.currentOverlapIndex];
      canvas.setActiveObject(obj);
    } else {
      const found = this.findObjectsAtPoint(canvas, pointer);

      // DESELECTION LOGIC:
      // If we clicked on an already selected object, we might want to cycle or deselect.
      // But standard CAD behavior is: click empty = deselect, click object = select.
      if (found.length === 0) {
        canvas.discardActiveObject();
        this.overlappingObjects = [];
        this.showContextToolbar.set(false);
      } else {
        this.overlappingObjects = found;
        this.currentOverlapIndex = 0;
        this.lastClickPos = { ...pointer };
        canvas.setActiveObject(found[0]);
      }
    }
    canvas.requestRenderAll();
  }

  private isObjectHit(
    obj: fabric.Object,
    pointer: CanvasPoint,
    hitTolerance: number,
  ): boolean {
    const customData = (obj as CustomFabricObject).customData;

    // Fast path for lines using world coordinates
    if (obj.type === "line" || customData?.type === "line") {
      const x1 =
        customData?.x1 !== undefined ? customData.x1 : (obj as fabric.Line).x1!;
      const y1 =
        customData?.y1 !== undefined ? customData.y1 : (obj as fabric.Line).y1!;
      const x2 =
        customData?.x2 !== undefined ? customData.x2 : (obj as fabric.Line).x2!;
      const y2 =
        customData?.y2 !== undefined ? customData.y2 : (obj as fabric.Line).y2!;

      const dist = this.pointToLineDistance(
        pointer.x,
        pointer.y,
        x1,
        y1,
        x2,
        y2,
      );
      return dist <= hitTolerance;
    }

    // Fast path for circles
    if (obj.type === "circle" || customData?.type === "circle") {
      const center = obj.getCenterPoint();
      const radius = (obj as fabric.Circle).radius || 0;
      const dist = Math.sqrt(
        (center.x - pointer.x) ** 2 + (center.y - pointer.y) ** 2,
      );
      return dist <= radius + hitTolerance;
    }

    if (customData?.isCadEntity) {
      const objType = obj.type;
      if (objType === "rect" || objType === "polygon") {
        const bound = obj.getBoundingRect(true);
        const edges = [
          {
            x1: bound.left,
            y1: bound.top,
            x2: bound.left + bound.width,
            y2: bound.top,
          },
          {
            x1: bound.left,
            y1: bound.top + bound.height,
            x2: bound.left + bound.width,
            y2: bound.top + bound.height,
          },
          {
            x1: bound.left,
            y1: bound.top,
            x2: bound.left,
            y2: bound.top + bound.height,
          },
          {
            x1: bound.left + bound.width,
            y1: bound.top,
            x2: bound.left + bound.width,
            y2: bound.top + bound.height,
          },
        ];

        for (const edge of edges) {
          if (
            this.pointToLineDistance(
              pointer.x,
              pointer.y,
              edge.x1,
              edge.y1,
              edge.x2,
              edge.y2,
            ) <= hitTolerance
          ) {
            return true;
          }
        }
        return false;
      }
    }

    return obj.containsPoint(new fabric.Point(pointer.x, pointer.y));
  }

  public reset(): void {
    this.lastClickPos = null;
    this.overlappingObjects = [];
    this.currentOverlapIndex = 0;
    this.snapGuide = null;
    this.showContextToolbar.set(false);
    this.contextToolbarPosition.set(null);
    this.selectedObjectType.set(null);
  }
}
