/**
 * Canvas Slab Detection Service
 * Handles automatic slab detection from canvas lines and conversion of
 * selected segments to slab polygons.
 * Extracted from EditorCanvasComponent for readability.
 */
import { Injectable, inject } from '@angular/core';
import { fabric } from 'fabric';
import { EditorStore } from '@stores/editor';
import { CanvasInteractionService } from '@services/canvas-interaction.service';
import { CanvasHistoryService } from '@services/canvas-history.service';
import { CustomFabricObject } from '@utils/canvas.utils';
import { mergeSegmentsToPolygon, Segment } from '@utils/geometry-healing.utils';

@Injectable()
export class CanvasSlabDetectionService {
  private readonly store = inject(EditorStore);
  private readonly interaction = inject(CanvasInteractionService);
  private readonly history = inject(CanvasHistoryService);

  /**
   * Automatically detect a slab contour starting from the clicked point.
   * Collects all lines on the canvas and attempts to merge them into a polygon.
   */
  public autoDetectSlab(
    canvas: fabric.Canvas,
    pointer: { x: number; y: number },
  ): void {
    // 1. Find the target line under the cursor
    const targets = this.interaction.findObjectsAtPoint(
      canvas,
      pointer,
    ) as CustomFabricObject[];
    const startObj = targets.find(
      (t) => t.customData?.type === 'line' || t.type === 'line',
    );
    if (!startObj) return;

    // 2. Collect ALL lines on the canvas
    const allLines = this.collectSegments(
      canvas.getObjects() as CustomFabricObject[],
    );

    // 3. Use healing utility to find the enclosing contour
    const points = mergeSegmentsToPolygon(allLines, 15);

    if (points.length >= 3) {
      this.store.createSlabFromPoints(points);
      canvas.requestRenderAll();
      this.history.saveState(canvas);
    }
  }

  /**
   * Convert currently selected CAD segments/lines into a single slab polygon.
   * Triggered from the context toolbar.
   */
  public convertSelectedToSlab(canvas: fabric.Canvas): void {
    const selected = canvas.getActiveObjects() as CustomFabricObject[];
    if (selected.length === 0) return;

    const segments: Segment[] = [];
    const storeShapeIdsToRemove: string[] = [];

    for (const obj of selected) {
      const data = obj.customData;

      if (data?.type === 'line' && data.x1 !== undefined) {
        segments.push({
          p1: { x: data.x1, y: data.y1! },
          p2: { x: data.x2!, y: data.y2! },
        });
      } else if (obj.type === 'line') {
        const line = obj as fabric.Line;
        segments.push({
          p1: { x: line.x1!, y: line.y1! },
          p2: { x: line.x2!, y: line.y2! },
        });
      }

      if (data?.id && !data.isCadEntity) {
        storeShapeIdsToRemove.push(data.id);
      }
    }

    if (segments.length === 0) return;

    const points = mergeSegmentsToPolygon(segments, 10);
    if (points.length >= 3) {
      this.store.createSlabFromPoints(points);

      if (storeShapeIdsToRemove.length > 0) {
        this.store.removeShapes(storeShapeIdsToRemove);
      }

      // Cleanup: remove non-CAD objects from canvas
      for (const obj of selected) {
        if (!obj.customData?.isCadEntity) {
          canvas.remove(obj);
        }
      }
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      this.history.saveState(canvas);
    }
  }

  // ========================================================================
  // Private helpers
  // ========================================================================

  /** Collect line segments from a list of Fabric objects */
  private collectSegments(objects: CustomFabricObject[]): Segment[] {
    const segments: Segment[] = [];

    for (const obj of objects) {
      const data = obj.customData;
      if (data?.type === 'line' && data.x1 !== undefined) {
        segments.push({
          p1: { x: data.x1, y: data.y1! },
          p2: { x: data.x2!, y: data.y2! },
        });
      } else if (obj.type === 'line') {
        const l = obj as fabric.Line;
        segments.push({
          p1: { x: l.x1!, y: l.y1! },
          p2: { x: l.x2!, y: l.y2! },
        });
      }
    }

    return segments;
  }
}
