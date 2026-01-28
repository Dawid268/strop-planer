import { Injectable, inject, signal } from "@angular/core";
import * as fabric from "fabric";
import { EditorStore } from "../store/editor.store";
import {
  CustomFabricObject,
  CANVAS_COLORS,
  CanvasPoint,
} from "../utils/canvas.utils";

@Injectable()
export class CanvasInteractionService {
  private readonly store = inject(EditorStore);

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
    const active = canvas.getActiveObject();
    if (!active) {
      this.showContextToolbar.set(false);
      this.selectedObjectType.set(null);
      return;
    }

    const customData = (active as CustomFabricObject).customData;
    this.selectedObjectType.set(customData?.type || null);

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
    canvas.bringObjectToFront(this.snapGuide);
    canvas.requestRenderAll();
  }

  public findObjectsAtPoint(
    canvas: fabric.Canvas,
    pointer: CanvasPoint,
  ): fabric.FabricObject[] {
    const objects: fabric.FabricObject[] = [];
    const zoom = canvas.getZoom();
    const tolerance = 15 / zoom;

    canvas.getObjects().forEach((obj) => {
      if ((obj as CustomFabricObject).customData?.isGrid) return;

      const bound = obj.getBoundingRect();
      const inBB =
        pointer.x >= bound.left - tolerance &&
        pointer.x <= bound.left + bound.width + tolerance &&
        pointer.y >= bound.top - tolerance &&
        pointer.y <= bound.top + bound.height + tolerance;

      if (!inBB) return;

      if (
        obj.containsPoint(new fabric.Point(pointer.x, pointer.y)) ||
        [
          { x: pointer.x - tolerance, y: pointer.y },
          { x: pointer.x + tolerance, y: pointer.y },
          { x: pointer.x, y: pointer.y - tolerance },
          { x: pointer.x, y: pointer.y + tolerance },
        ].some((p) => obj.containsPoint(new fabric.Point(p.x, p.y)))
      ) {
        objects.push(obj);
      }
    });

    objects.sort((a, b) => {
      const aSize =
        (a.width || 0) * (a.scaleX || 1) * (a.height || 0) * (a.scaleY || 1);
      const bSize =
        (b.width || 0) * (b.scaleX || 1) * (b.height || 0) * (b.scaleY || 1);
      return aSize - bSize;
    });

    return objects;
  }

  public selectSmallestAtPoint(
    canvas: fabric.Canvas,
    pointer: CanvasPoint,
  ): void {
    const zoom = canvas.getZoom();
    const threshold = 5 / zoom;

    const samePosition =
      this.lastClickPos &&
      Math.abs(pointer.x - this.lastClickPos.x) < threshold &&
      Math.abs(pointer.y - this.lastClickPos.y) < threshold;

    if (samePosition && this.overlappingObjects.length > 1) {
      this.currentOverlapIndex =
        (this.currentOverlapIndex + 1) % this.overlappingObjects.length;
      canvas.setActiveObject(this.overlappingObjects[this.currentOverlapIndex]);
    } else {
      this.overlappingObjects = this.findObjectsAtPoint(canvas, pointer);
      this.currentOverlapIndex = 0;
      this.lastClickPos = { ...pointer };
      if (this.overlappingObjects.length > 0) {
        canvas.setActiveObject(this.overlappingObjects[0]);
      }
    }
    canvas.requestRenderAll();
  }
}
