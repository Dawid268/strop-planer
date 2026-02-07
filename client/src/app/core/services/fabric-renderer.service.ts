import { Injectable, NgZone, inject } from '@angular/core';
import { fabric } from 'fabric';

import { CustomFabricObject, ExtendedFabricCanvas } from '@utils/canvas.utils';
import type {
  CadData,
  CadEntity,
  CadBounds,
  CadLayerState,
} from '@models/cad.models';

@Injectable({ providedIn: 'root' })
export class FabricRendererService {
  private readonly ngZone = inject(NgZone);
  private canvas: ExtendedFabricCanvas | null = null;

  public getCanvas(): fabric.Canvas | null {
    return this.canvas;
  }

  public init(canvasElement: HTMLCanvasElement): void {
    this.ngZone.runOutsideAngular(() => {
      this.canvas = new fabric.Canvas(canvasElement, {
        backgroundColor: '#1e1e1e',
        preserveObjectStacking: true,
        selection: true,
        targetFindTolerance: 3,
        perPixelTargetFind: false,
        renderOnAddRemove: false,
        statefullCache: false,
        imageSmoothingEnabled: false, // Performance: faster bitmap rendering
      }) as ExtendedFabricCanvas;

      this.canvas.isDragging = false;
      this.canvas.lastPosX = 0;
      this.canvas.lastPosY = 0;

      this.setupEvents();
      this.resizeCanvas();
    });
  }

  public renderCadData(data: CadData, state?: CadLayerState): void {
    if (!this.canvas) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      // Remove existing CAD objects (keep user-drawn shapes)
      const existingCadObjects = this.canvas!.getObjects().filter(
        (obj: fabric.Object) =>
          (obj as CustomFabricObject).customData?.isCadEntity,
      );
      existingCadObjects.forEach((obj) => this.canvas!.remove(obj));

      this.canvas!.renderOnAddRemove = false;

      let entityCount = 0;

      const applyState = (obj: fabric.Object, entityType: string): void => {
        if (state) {
          if (state.visible !== undefined) obj.set('visible', state.visible);
          if (state.opacity !== undefined) obj.set('opacity', state.opacity);
          if (state.locked !== undefined) {
            const isText = entityType === 'text';
            obj.set('selectable', !state.locked && !isText);
            obj.set('evented', !state.locked && !isText);
          }
        }
      };

      // Process entities grouped by layers
      if (data.layers) {
        Object.entries(data.layers).forEach(
          ([layerName, entities]: [string, CadEntity[]]) => {
            entities.forEach((entity: CadEntity) => {
              const obj = this.createFabricObject(entity, layerName);
              if (obj) {
                applyState(obj, entity.type);
                this.canvas?.add(obj);
                entityCount++;
              }
            });
          },
        );
      } else if (data.entities) {
        // Fallback for old flat structure
        data.entities.forEach((entity: CadEntity) => {
          const obj = this.createFabricObject(entity, 'default');
          if (obj) {
            applyState(obj, entity.type);
            this.canvas?.add(obj);
            entityCount++;
          }
        });
      }

      // Send CAD entities to back so user shapes render on top
      this.canvas!.getObjects()
        .filter(
          (obj: fabric.Object) =>
            (obj as CustomFabricObject).customData?.isCadEntity,
        )
        .forEach((obj) => this.canvas!.sendToBack(obj));

      if (entityCount > 0) {
        this.zoomToFit(data.bounds);
      }

      this.canvas!.renderOnAddRemove = true;
      this.canvas?.requestRenderAll();
    });
  }

  /** Removes all CAD entities from the canvas (e.g. when switching to a tab without CAD layer). */
  public clearCadObjects(): void {
    const canvas = this.canvas;
    if (!canvas) return;
    this.ngZone.runOutsideAngular(() => {
      const existingCadObjects = canvas
        .getObjects()
        .filter(
          (obj: fabric.Object) =>
            (obj as CustomFabricObject).customData?.isCadEntity,
        );
      existingCadObjects.forEach((obj) => canvas.remove(obj));
      canvas.requestRenderAll();
    });
  }

  public batchUpdateCadObjects(state: CadLayerState): void {
    if (!this.canvas) return;

    this.ngZone.runOutsideAngular(() => {
      const cadObjects = this.canvas!.getObjects().filter(
        (obj: fabric.Object) =>
          (obj as CustomFabricObject).customData?.isCadEntity,
      );

      this.canvas!.renderOnAddRemove = false;
      cadObjects.forEach((obj) => {
        if (state.visible !== undefined) obj.set('visible', state.visible);
        if (state.opacity !== undefined) obj.set('opacity', state.opacity);
        if (state.locked !== undefined) {
          const customObj = obj as CustomFabricObject;
          const isText = customObj.customData?.type === 'text';
          obj.set('selectable', !state.locked && !isText);
          obj.set('evented', !state.locked && !isText);
        }
      });
      this.canvas!.renderOnAddRemove = true;
      this.canvas!.requestRenderAll();
    });
  }

  private createFabricObject(
    entity: CadEntity,
    layerName: string,
  ): fabric.Object | null {
    const isLine = entity.type === 'line';
    const isPolyline = entity.type === 'polyline';
    const isSelectable = isLine || isPolyline; // Only lines/polylines are selectable

    const commonProps = {
      selectable: isSelectable,
      evented: isSelectable,
      stroke: entity.stroke || '#FFFFFF',
      strokeWidth: isLine ? 0.4 : 0.3,
      fill: 'transparent',
      // Selection visibility - bright cyan border
      borderColor: '#00ffff',
      borderScaleFactor: 2,
      padding: isSelectable ? 8 : 0, // Optimized hit area
      hasBorders: true,
      hasControls: false,
      // PERFORMANCE: Disable perPixelTargetFind for thousands of objects.
      perPixelTargetFind: false,
      skipOffscreen: true, // Allow Fabric to skip rendering if outside viewport

      // PERFORMANCE: For thousands of simple lines, caching overhead outweighs benefit.
      // Disabling caching makes zoom/pan much smoother.
      objectCaching: false,
      noScaleCache: true,
      statefulCache: false,

      lockMovementX: true, // CAD elements shouldn't move
      lockMovementY: true,
      lockRotation: true,
      lockScalingX: true,
      lockScalingY: true,
    };

    let fabricObj: fabric.Object | null = null;

    switch (entity.type) {
      case 'line':
        fabricObj = new fabric.Line(
          [entity.x1 ?? 0, entity.y1 ?? 0, entity.x2 ?? 0, entity.y2 ?? 0],
          commonProps,
        );
        break;
      case 'circle':
        fabricObj = new fabric.Circle({
          ...commonProps,
          left: entity.left,
          top: entity.top,
          radius: entity.radius ?? 0,
          originX: 'center',
          originY: 'center',
        });
        break;
      case 'polyline':
        return null; // Polylines are now pre-flattened to line segments on the backend
      case 'text':
        fabricObj = new fabric.Text(entity.text ?? '', {
          ...commonProps,
          selectable: false,
          evented: false,
          left: entity.left,
          top: entity.top,
          fontSize: entity.fontSize || 12,
          fill: entity.fill || '#FFFFFF',
          strokeWidth: 0,
        });
        break;
      default:
        return null;
    }

    if (fabricObj) {
      // Add custom data for identification
      (fabricObj as CustomFabricObject).customData = {
        id: `cad-${entity.layer || '0'}-${Date.now()}-${Math.random()}`,
        type: entity.type,
        layerName: layerName,
        isCadEntity: true,
        // Store world coordinates for faster selection without matrix calc
        x1: entity.x1,
        y1: entity.y1,
        x2: entity.x2,
        y2: entity.y2,
        radius: entity.radius,
        left: entity.left,
        top: entity.top,
      };

      // Ensure hit-test stays consistent across zoom levels
      fabricObj.set('strokeUniform', true);
    }

    return fabricObj;
  }

  public zoomToFit(bounds: CadBounds): void {
    if (!this.canvas) return;

    const canvasWidth = this.canvas.getWidth();
    const canvasHeight = this.canvas.getHeight();
    const worldWidth = bounds.maxX - bounds.minX;
    const worldHeight = bounds.maxY - bounds.minY;

    if (worldWidth === 0 || worldHeight === 0) return;

    const scaleX = canvasWidth / worldWidth;
    const scaleY = canvasHeight / worldHeight;
    const scale = Math.min(scaleX, scaleY) * 0.9; // 10% padding

    const centerWorldX = (bounds.minX + bounds.maxX) / 2;
    // Note: bounds.minY is the bottom in DXF, but maxY is top in Fabric because of flip?
    // Actually the bounds in data are still DXF bounds.
    // In our converter: top = maxY_dxf - y_dxf.
    // So the visual Y center is (maxY_dxf - minY_dxf) / 2? No.
    // Let's just use Fabric's built-in center if possible or calc accurately.

    // Simplest: use all objects bounding box
    const center = this.canvas.getCenter();
    this.canvas.setZoom(scale);

    // Correct translation to center the bounds
    const vpt = this.canvas.viewportTransform;
    if (vpt) {
      vpt[4] = center.left - centerWorldX * scale;
      vpt[5] = center.top - ((bounds.minY + bounds.maxY) / 2) * scale;
    }

    this.canvas.requestRenderAll();
  }

  private setupEvents(): void {
    // NOTE: Mouse events (wheel, pan, selection) are handled by EditorCanvasComponent
    // which integrates with ViewportService for proper state management.
    // This method is kept for any FabricRenderer-specific events if needed in the future.
  }

  private resizeCanvas(): void {
    if (!this.canvas) return;
    const parent = this.canvas.getElement().parentElement;
    if (parent) {
      this.canvas.setDimensions({
        width: parent.clientWidth,
        height: parent.clientHeight,
      });
    }
  }

  public destroy(): void {
    this.canvas?.dispose();
    this.canvas = null;
  }
}
