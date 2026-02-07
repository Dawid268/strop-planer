import { Injectable } from '@angular/core';
import { fabric } from 'fabric';
import { CustomFabricObject, CANVAS_COLORS } from '@utils/canvas.utils';

export interface ShapeMetadata {
  id: string;
  type: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  points?: Array<{ x: number; y: number }>;
  properties?: Record<string, unknown>;
  layerId?: string;
  isVisible?: boolean;
  isLocked?: boolean;
  opacity?: number;
}

/**
 * Service that handles synchronization between store shapes and Fabric.js canvas objects.
 * Optimizes rendering by tracking objects and only updating changed properties.
 */
@Injectable()
export class CanvasShapeSyncService {
  /**
   * Performance optimization: Track Fabric objects by their ID to avoid re-creating them.
   * This is crucial for smooth layer toggling and rapid state changes.
   */
  private shapeMap = new Map<string, fabric.Object>();

  /**
   * Clears the internal shape map. Call when resetting the canvas.
   */
  public reset(): void {
    this.shapeMap.clear();
  }

  /**
   * Synchronizes shapes from the store with the canvas.
   * Creates new objects, updates existing ones, and removes orphaned objects.
   */
  public syncShapes(canvas: fabric.Canvas, shapes: ShapeMetadata[]): void {
    if (!canvas) return;

    const activeShapeIds = new Set(shapes.map((s) => s.id));

    // Remove objects that are no longer in the store
    this.shapeMap.forEach((obj, id) => {
      if (!activeShapeIds.has(id)) {
        canvas.remove(obj);
        this.shapeMap.delete(id);
      }
    });

    // Disable rendering during batch operations
    canvas.renderOnAddRemove = false;

    shapes.forEach((shape) => {
      const existingObj = this.shapeMap.get(shape.id);
      const isVisible = shape.isVisible ?? true;
      const isLocked = shape.isLocked ?? false;
      const opacity = shape.opacity ?? 1;
      const isAi = this.isAiShape(shape.id);
      const isWallLine = isAi && shape.points?.length === 2;

      if (existingObj) {
        // Only update properties if object already exists
        existingObj.set({
          visible: isVisible,
          opacity: opacity,
          selectable: !isLocked && (isWallLine || !isAi),
          evented: !isLocked && (isWallLine || !isAi),
        });
        return;
      }

      // Create new object if not in map
      const newObj = this.createFabricObject(shape, isAi, isWallLine);

      if (newObj) {
        this.applyCustomData(newObj, shape, isWallLine);
        newObj.set({
          visible: isVisible,
          opacity: opacity,
          selectable: !isLocked && (isWallLine || !isAi),
          evented: !isLocked && (isWallLine || !isAi),
        });
        canvas.add(newObj);
        this.shapeMap.set(shape.id, newObj);
      }
    });

    canvas.renderOnAddRemove = true;
    canvas.requestRenderAll();
  }

  /**
   * Removes a shape from both the canvas and the internal map.
   */
  public removeShape(canvas: fabric.Canvas, shapeId: string): void {
    const obj = this.shapeMap.get(shapeId);
    if (obj) {
      canvas.remove(obj);
      this.shapeMap.delete(shapeId);
    }
  }

  /**
   * Gets the current shape count.
   */
  public getShapeCount(): number {
    return this.shapeMap.size;
  }

  /**
   * Checks if a shape with the given ID exists in the map.
   */
  public hasShape(shapeId: string): boolean {
    return this.shapeMap.has(shapeId);
  }

  /**
   * Gets a Fabric object by shape ID.
   */
  public getObject(shapeId: string): fabric.Object | undefined {
    return this.shapeMap.get(shapeId);
  }

  private isAiShape(id: string): boolean {
    return (
      id?.startsWith('ai-poly-') ||
      id?.startsWith('ai-line-') ||
      id?.startsWith('ai-boundary-') ||
      id?.startsWith('ai-hole-')
    );
  }

  private createFabricObject(
    shape: ShapeMetadata,
    isAi: boolean,
    isWallLine: boolean,
  ): fabric.Object | null {
    switch (shape.type) {
      case 'slab':
      case 'polygon':
        return this.createPolygonObject(shape, isAi, isWallLine);
      case 'beam':
        return this.createBeamObject(shape);
      case 'panel':
        return this.createPanelObject(shape);
      case 'prop':
        return this.createPropObject(shape);
      case 'rectangle':
        return this.createRectangleObject(shape);
      default:
        return null;
    }
  }

  private createPolygonObject(
    shape: ShapeMetadata,
    isAi: boolean,
    isWallLine: boolean,
  ): fabric.Object | null {
    if (!shape.points || shape.points.length < 2) return null;

    if (isAi) {
      return new fabric.Polyline(shape.points, {
        left: shape.x ?? 0,
        top: shape.y ?? 0,
        fill: 'transparent',
        stroke: isWallLine ? '#1565c0' : '#333333',
        strokeWidth: isWallLine ? 1.5 : 0.5,
        objectCaching: true,
        hasControls: false,
        hasBorders: isWallLine,
        ...(isWallLine && {
          perPixelTargetFind: true,
          padding: 6,
        }),
      });
    }

    if (shape.points.length >= 3) {
      return new fabric.Polygon(shape.points, {
        left: shape.x ?? 0,
        top: shape.y ?? 0,
        fill: CANVAS_COLORS.POLYGON_FILL,
        stroke: CANVAS_COLORS.POLYGON_STROKE,
        strokeWidth: 2,
      });
    }

    if (shape.points.length === 2) {
      return new fabric.Polyline(shape.points, {
        left: shape.x ?? 0,
        top: shape.y ?? 0,
        fill: 'transparent',
        stroke: CANVAS_COLORS.POLYGON_STROKE,
        strokeWidth: 1.5,
        perPixelTargetFind: true,
        padding: 6,
      });
    }

    return null;
  }

  private createBeamObject(shape: ShapeMetadata): fabric.Object {
    return new fabric.Line([0, 0, 100, 0], {
      left: shape.x,
      top: shape.y,
      stroke: CANVAS_COLORS.BEAM,
      strokeWidth: 3,
      angle: shape.rotation ?? 0,
      originX: 'center',
      originY: 'center',
    });
  }

  private createPanelObject(shape: ShapeMetadata): fabric.Object {
    return new fabric.Rect({
      left: shape.x,
      top: shape.y,
      width: shape.width ?? 120,
      height: shape.height ?? 60,
      fill: (shape.properties?.['fill'] as string) ?? CANVAS_COLORS.PANEL_FILL,
      stroke:
        (shape.properties?.['stroke'] as string) ?? CANVAS_COLORS.PANEL_STROKE,
      strokeWidth: 1,
      angle: shape.rotation ?? 0,
      originX: 'center',
      originY: 'center',
    });
  }

  private createPropObject(shape: ShapeMetadata): fabric.Object {
    return new fabric.Circle({
      left: shape.x,
      top: shape.y,
      radius: 15,
      fill: CANVAS_COLORS.PROP_FILL,
      stroke: CANVAS_COLORS.PROP_STROKE,
      strokeWidth: 2,
      angle: shape.rotation ?? 0,
      originX: 'center',
      originY: 'center',
    });
  }

  private createRectangleObject(shape: ShapeMetadata): fabric.Object | null {
    if (!shape.width || !shape.height) return null;

    return new fabric.Rect({
      left: shape.x,
      top: shape.y,
      width: shape.width,
      height: shape.height,
      fill: 'rgba(200, 200, 200, 0.3)',
      stroke: '#666',
      strokeWidth: 1,
      angle: shape.rotation ?? 0,
    });
  }

  private applyCustomData(
    fabricObj: fabric.Object,
    shape: ShapeMetadata,
    isWallLine: boolean,
  ): void {
    (fabricObj as CustomFabricObject).customData = {
      id: shape.id,
      type: shape.type,
      layerId: shape.layerId,
      isWallLine: isWallLine,
    };
  }
}
