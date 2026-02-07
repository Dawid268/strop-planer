import { Injectable, signal } from '@angular/core';
import { fabric } from 'fabric';
import { CustomFabricObject } from '@utils/canvas.utils';

export interface SelectionRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Service responsible for canvas selection operations.
 * Handles single-click selection and marquee (box) selection.
 */
@Injectable()
export class CanvasSelectionService {
  /** Start point of marquee selection in canvas coordinates */
  public readonly marqueeStart = signal<{ x: number; y: number } | null>(null);

  /** Threshold in pixels for distinguishing click from drag */
  private readonly clickThreshold = 5;

  /**
   * Starts a potential marquee selection.
   * Called on mouse down when clicking on empty canvas area.
   */
  public startMarquee(pointer: { x: number; y: number }): void {
    this.marqueeStart.set({ x: pointer.x, y: pointer.y });
  }

  /**
   * Clears the marquee selection state.
   */
  public clearMarquee(): void {
    this.marqueeStart.set(null);
  }

  /**
   * Checks if the mouse movement is sufficient to be considered a drag.
   */
  public isMarqueeDrag(
    startPoint: { x: number; y: number },
    endPoint: { x: number; y: number },
  ): boolean {
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance >= this.clickThreshold;
  }

  /**
   * Finds all selectable objects within the given rectangle.
   * Uses canvas coordinates for both selection rect and object positions.
   *
   * @param canvas - The Fabric.js canvas
   * @param rect - Selection rectangle in canvas coordinates
   * @returns Array of objects that overlap with the selection rectangle
   */
  public findObjectsInRect(
    canvas: fabric.Canvas,
    rect: SelectionRect,
  ): fabric.Object[] {
    const { x1, y1, x2, y2 } = this.normalizeRect(rect);
    const collected: fabric.Object[] = [];
    const objects = canvas.getObjects();

    // Iterate in reverse for consistent selection order (top objects first)
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      const customData = (obj as CustomFabricObject).customData;

      // Skip grid, non-selectable, and invisible objects
      if (customData?.isGrid || !obj.selectable || !obj.visible) {
        continue;
      }

      // Object coordinates in canvas space
      const objBounds = this.getObjectBounds(obj);

      // Check if selection rect overlaps with object bounding rect
      const overlaps =
        x1 < objBounds.right &&
        x2 > objBounds.left &&
        y1 < objBounds.bottom &&
        y2 > objBounds.top;

      if (overlaps) {
        collected.push(obj);
      }
    }

    return collected;
  }

  /**
   * Creates and sets the active selection on the canvas.
   *
   * @param canvas - The Fabric.js canvas
   * @param objects - Objects to select
   */
  public applySelection(canvas: fabric.Canvas, objects: fabric.Object[]): void {
    if (objects.length === 0) {
      canvas.discardActiveObject();
    } else if (objects.length === 1) {
      canvas.setActiveObject(objects[0]);
    } else {
      const selection = new fabric.ActiveSelection(objects, { canvas });
      canvas.setActiveObject(selection);
    }
    canvas.requestRenderAll();
  }

  /**
   * Gets the IDs of all selected objects.
   */
  public getSelectedIds(canvas: fabric.Canvas): string[] {
    const selected = canvas.getActiveObjects() || [];
    return selected
      .map((obj) => (obj as CustomFabricObject).customData?.id)
      .filter((id): id is string => Boolean(id));
  }

  /**
   * Normalizes a selection rectangle so that (x1,y1) is always top-left
   * and (x2,y2) is always bottom-right.
   */
  private normalizeRect(rect: SelectionRect): SelectionRect {
    return {
      x1: Math.min(rect.x1, rect.x2),
      y1: Math.min(rect.y1, rect.y2),
      x2: Math.max(rect.x1, rect.x2),
      y2: Math.max(rect.y1, rect.y2),
    };
  }

  /**
   * Gets object bounds in canvas coordinates.
   * Uses object's position and dimensions with scaling applied.
   */
  private getObjectBounds(obj: fabric.Object): {
    left: number;
    top: number;
    right: number;
    bottom: number;
  } {
    const left = obj.left ?? 0;
    const top = obj.top ?? 0;
    const width = (obj.width ?? 0) * (obj.scaleX ?? 1);
    const height = (obj.height ?? 0) * (obj.scaleY ?? 1);

    return {
      left,
      top,
      right: left + width,
      bottom: top + height,
    };
  }
}
