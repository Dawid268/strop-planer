import { Injectable, inject, signal } from '@angular/core';
import { fabric } from 'fabric';
import {
  CustomFabricObject,
  CanvasPoint,
  getPolygonPoints,
} from '@utils/canvas.utils';
import { CanvasHistoryService } from './canvas-history.service';
import { ErrorHandlerService } from './error-handler.service';
import type { RawGeometry } from '@models/geometry.models';

@Injectable()
export class CanvasStateService {
  private readonly historyService = inject(CanvasHistoryService);
  private readonly errorHandler = inject(ErrorHandlerService);

  public readonly isLoading = signal(false);
  public readonly objectCount = signal(0);
  private currentSvgUrl: string | null = null;

  public updateObjectCount(canvas: fabric.Canvas | null): void {
    if (!canvas) return;
    const count = canvas
      .getObjects()
      .filter((o) => !(o as CustomFabricObject).customData?.isGrid).length;
    this.objectCount.set(count);
  }

  public async loadSvgFromUrl(
    canvas: fabric.Canvas | null,
    url: string,
  ): Promise<void> {
    if (!canvas || this.currentSvgUrl === url) return;

    this.isLoading.set(true);
    this.currentSvgUrl = url;

    try {
      const result = await fabric.loadSVGFromURL(url);
      if (!result.objects || result.objects.length === 0) {
        this.isLoading.set(false);
        return;
      }

      // Clear existing background only
      const existingObjects = canvas.getObjects();
      existingObjects.forEach((obj) => {
        if ((obj as CustomFabricObject).customData?.isFromSvg) {
          canvas.remove(obj);
        }
      });

      const group = new fabric.Group(
        result.objects.filter((o): o is fabric.FabricObject => o !== null),
        { selectable: false, evented: false, objectCaching: true },
      );

      const dataUrl = group.toDataURL({ format: 'png', multiplier: 1 });
      const img = await fabric.Image.fromURL(dataUrl);

      img.set({
        left: group.left,
        top: group.top,
        selectable: false,
        evented: false,
      });

      (img as CustomFabricObject).customData = {
        id: 'static-svg-bg',
        isFromSvg: true,
      };

      canvas.add(img);
      canvas.sendToBack(img);
      this.isLoading.set(false);
      this.updateObjectCount(canvas);
      canvas.requestRenderAll();
    } catch (error) {
      this.errorHandler.handleError(error);
      this.isLoading.set(false);
    }
  }

  public loadPolygonsFromGeometry(
    canvas: fabric.Canvas | null,
    geometryData: RawGeometry | null,
  ): void {
    if (!geometryData) return;

    const lines = geometryData.lines;
    const polygons = lines?.length
      ? lines.map((l) => [l.a, l.b])
      : (geometryData.polygons ?? []);
    if (!canvas || polygons.length === 0) return;

    this.isLoading.set(true);

    const existingObjects = canvas.getObjects();
    existingObjects.forEach((obj) => {
      if ((obj as CustomFabricObject).customData?.isFromGeometry) {
        canvas.remove(obj);
      }
    });

    const BATCH_SIZE = 200;
    let processedCount = 0;

    const processBatch = (deadline?: IdleDeadline): void => {
      const batchEnd = Math.min(processedCount + BATCH_SIZE, polygons.length);

      while (processedCount < batchEnd) {
        const polyPoints = getPolygonPoints(polygons[processedCount]);
        if (polyPoints.length < 2) {
          processedCount++;
          continue;
        }

        let fabricObj: fabric.FabricObject;
        if (polyPoints.length === 2) {
          fabricObj = new fabric.Line(
            [
              polyPoints[0].x,
              polyPoints[0].y,
              polyPoints[1].x,
              polyPoints[1].y,
            ],
            {
              stroke: '#333333',
              strokeWidth: 1,
              fill: '',
              selectable: true,
              evented: true,
              objectCaching: true,
            },
          );
        } else {
          fabricObj = new fabric.Polygon(
            polyPoints.map((p: CanvasPoint) => ({ x: p.x, y: p.y })),
            {
              stroke: '#333333',
              strokeWidth: 1,
              fill: 'transparent',
              selectable: true,
              evented: true,
              objectCaching: true,
              perPixelTargetFind: true,
            },
          );
        }

        (fabricObj as CustomFabricObject).customData = {
          id: `polygon-${processedCount}`,
          isFromGeometry: true,
        };

        canvas.add(fabricObj);
        processedCount++;
        if (deadline && deadline.timeRemaining() < 1) break;
      }

      this.objectCount.set(processedCount);

      if (processedCount < polygons.length) {
        if ('requestIdleCallback' in window) {
          window.requestIdleCallback(processBatch, { timeout: 100 });
        } else {
          setTimeout(() => processBatch(), 0);
        }
      } else {
        this.isLoading.set(false);
        canvas.requestRenderAll();
        this.historyService.saveState(canvas);
      }
    };

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(processBatch, { timeout: 100 });
    } else {
      processBatch();
    }
  }

  public addShapeToStore(obj: CustomFabricObject): void {
    if (!obj.customData?.id) return;

    // Determine shape data based on fabric object type
    // This is a simplified version, as the store should be the source of truth usually
    // But for newly drawn items, we sync them here.
  }

  public clearBackground(canvas: fabric.Canvas | null): void {
    if (!canvas) return;
    canvas.getObjects().forEach((obj) => {
      if ((obj as CustomFabricObject).customData?.isFromSvg) {
        canvas.remove(obj);
      }
    });
    this.currentSvgUrl = null;
    canvas.requestRenderAll();
  }

  public clearGeometry(canvas: fabric.Canvas | null): void {
    if (!canvas) return;
    canvas.getObjects().forEach((obj) => {
      if ((obj as CustomFabricObject).customData?.isFromGeometry) {
        canvas.remove(obj);
      }
    });
    canvas.requestRenderAll();
  }

  public clearCanvas(canvas: fabric.Canvas | null): void {
    if (!canvas) return;
    const objects = canvas.getObjects();
    objects.forEach((obj) => {
      if (!(obj as CustomFabricObject).customData?.isGrid) {
        canvas.remove(obj);
      }
    });
    this.objectCount.set(0);
    this.currentSvgUrl = null;
    canvas.requestRenderAll();
  }
}
