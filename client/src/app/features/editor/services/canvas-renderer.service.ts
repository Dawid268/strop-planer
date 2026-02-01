import { Injectable, signal, NgZone, inject } from '@angular/core';
import * as fabric from 'fabric';
import { CustomFabricObject, CANVAS_COLORS } from '../utils/canvas.utils';

export interface RenderStats {
  totalShapes: number;
  renderedShapes: number;
  visibleShapes: number;
  fps: number;
  lastRenderTime: number;
}

export interface RenderChunk {
  id: string;
  shapes: any[];
  fabricObjects: fabric.FabricObject[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  isVisible: boolean;
  isRendered: boolean;
}

const CHUNK_SIZE = 500;
const RENDER_BATCH_SIZE = 100;
const RENDER_DELAY_MS = 16;

@Injectable()
export class CanvasRendererService {
  private readonly ngZone = inject(NgZone);

  private canvas: fabric.Canvas | null = null;
  private chunks: Map<string, RenderChunk> = new Map();
  private renderQueue: string[] = [];
  private isRendering = false;
  private frameId: number | null = null;
  private frameCount = 0;
  private fpsUpdateTime = 0;

  readonly isLoading = signal(false);
  readonly loadingProgress = signal(0);
  readonly loadingMessage = signal('');
  readonly stats = signal<RenderStats>({
    totalShapes: 0,
    renderedShapes: 0,
    visibleShapes: 0,
    fps: 0,
    lastRenderTime: 0,
  });

  private worker: Worker | null = null;

  setCanvas(canvas: fabric.Canvas): void {
    this.canvas = canvas;
    this.setupViewportTracking();
  }

  private setupViewportTracking(): void {
    if (!this.canvas) return;

    let viewportUpdateTimeout: ReturnType<typeof setTimeout> | null = null;

    this.canvas.on('after:render', () => {
      this.updateFps();
    });

    const debouncedViewportUpdate = () => {
      if (viewportUpdateTimeout) {
        clearTimeout(viewportUpdateTimeout);
      }
      viewportUpdateTimeout = setTimeout(() => {
        this.updateVisibleChunks();
      }, 50);
    };

    this.canvas.on('mouse:wheel', debouncedViewportUpdate);
    this.canvas.on('mouse:move', (e) => {
      if ((e.e as MouseEvent).buttons === 1 || (e.e as MouseEvent).buttons === 4) {
        debouncedViewportUpdate();
      }
    });
  }

  private updateFps(): void {
    const now = performance.now();
    this.frameCount++;

    if (now - this.fpsUpdateTime >= 1000) {
      const fps = Math.round((this.frameCount * 1000) / (now - this.fpsUpdateTime));
      this.stats.update(s => ({ ...s, fps }));
      this.frameCount = 0;
      this.fpsUpdateTime = now;
    }
  }

  loadShapesWithWorker(rawGeometry: any): void {
    this.isLoading.set(true);
    this.loadingProgress.set(0);
    this.loadingMessage.set('Inicjalizacja...');
    this.clearAllChunks();

    if (typeof Worker !== 'undefined') {
      this.worker = new Worker(
        new URL('../workers/geometry.worker', import.meta.url),
        { type: 'module' }
      );

      this.worker.onmessage = ({ data }) => {
        this.ngZone.run(() => {
          switch (data.type) {
            case 'chunk':
              this.handleChunkReceived(data.data);
              break;
            case 'progress':
              this.loadingProgress.set(data.data.processed / data.data.total * 100);
              this.loadingMessage.set(data.data.message);
              break;
            case 'complete':
              this.handleLoadingComplete(data.data);
              break;
            case 'error':
              console.error('Worker error:', data.error);
              this.isLoading.set(false);
              break;
          }
        });
      };

      this.worker.postMessage({
        type: 'parse',
        data: rawGeometry,
        chunkSize: CHUNK_SIZE,
      });
    } else {
      this.loadShapesSync(rawGeometry);
    }
  }

  private handleChunkReceived(chunkData: any): void {
    const chunkId = `chunk-${chunkData.chunkIndex}`;

    const bounds = this.calculateBounds(chunkData.shapes);

    const chunk: RenderChunk = {
      id: chunkId,
      shapes: chunkData.shapes,
      fabricObjects: [],
      bounds,
      isVisible: false,
      isRendered: false,
    };

    this.chunks.set(chunkId, chunk);

    this.stats.update(s => ({
      ...s,
      totalShapes: s.totalShapes + chunkData.shapes.length,
    }));

    this.loadingProgress.set(chunkData.progress);
  }

  private handleLoadingComplete(data: any): void {
    this.isLoading.set(false);
    this.loadingProgress.set(100);
    this.loadingMessage.set(`Załadowano ${data.totalShapes} elementów`);

    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.updateVisibleChunks();
  }

  private loadShapesSync(rawGeometry: any): void {
    const polygons = rawGeometry?.polygons || [];
    const total = polygons.length;

    for (let i = 0; i < total; i += CHUNK_SIZE) {
      const chunkPolygons = polygons.slice(i, Math.min(i + CHUNK_SIZE, total));
      const shapes = chunkPolygons.map((poly: any, idx: number) => {
        const globalIdx = i + idx;
        if (Array.isArray(poly) && poly.length >= 2) {
          return {
            id: `ai-poly-${globalIdx}`,
            type: 'polygon',
            points: poly.map((p: any) => ({ x: p.x, y: p.y })),
            x: 0,
            y: 0,
          };
        }
        return null;
      }).filter(Boolean);

      this.handleChunkReceived({
        chunkIndex: Math.floor(i / CHUNK_SIZE),
        shapes,
        progress: Math.round(((i + CHUNK_SIZE) / total) * 100),
      });
    }

    this.handleLoadingComplete({ totalShapes: total });
  }

  private calculateBounds(shapes: any[]): RenderChunk['bounds'] {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const shape of shapes) {
      if (shape.points) {
        for (const p of shape.points) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
      }
    }

    return { minX, minY, maxX, maxY };
  }

  private updateVisibleChunks(): void {
    if (!this.canvas) return;

    const vpt = this.canvas.viewportTransform;
    if (!vpt) return;

    const zoom = this.canvas.getZoom();
    const width = this.canvas.width || 0;
    const height = this.canvas.height || 0;

    const viewMinX = -vpt[4] / zoom;
    const viewMinY = -vpt[5] / zoom;
    const viewMaxX = viewMinX + width / zoom;
    const viewMaxY = viewMinY + height / zoom;

    const margin = 200 / zoom;

    let visibleCount = 0;

    for (const [chunkId, chunk] of this.chunks) {
      const isVisible = !(
        chunk.bounds.maxX < viewMinX - margin ||
        chunk.bounds.minX > viewMaxX + margin ||
        chunk.bounds.maxY < viewMinY - margin ||
        chunk.bounds.minY > viewMaxY + margin
      );

      if (isVisible && !chunk.isRendered) {
        this.queueChunkRender(chunkId);
      } else if (!isVisible && chunk.isRendered) {
        this.unrenderChunk(chunkId);
      }

      chunk.isVisible = isVisible;
      if (isVisible) {
        visibleCount += chunk.shapes.length;
      }
    }

    this.stats.update(s => ({ ...s, visibleShapes: visibleCount }));
  }

  private queueChunkRender(chunkId: string): void {
    if (!this.renderQueue.includes(chunkId)) {
      this.renderQueue.push(chunkId);
    }
    this.processRenderQueue();
  }

  private processRenderQueue(): void {
    if (this.isRendering || this.renderQueue.length === 0) return;

    this.isRendering = true;

    const processNextBatch = () => {
      const startTime = performance.now();
      let processed = 0;

      while (this.renderQueue.length > 0 && processed < RENDER_BATCH_SIZE) {
        const chunkId = this.renderQueue.shift()!;
        this.renderChunk(chunkId);
        processed++;

        if (performance.now() - startTime > RENDER_DELAY_MS) {
          break;
        }
      }

      if (this.renderQueue.length > 0) {
        this.frameId = requestAnimationFrame(processNextBatch);
      } else {
        this.isRendering = false;
        this.canvas?.requestRenderAll();
      }
    };

    this.frameId = requestAnimationFrame(processNextBatch);
  }

  private renderChunk(chunkId: string): void {
    const chunk = this.chunks.get(chunkId);
    if (!chunk || chunk.isRendered || !this.canvas) return;

    const objects: fabric.FabricObject[] = [];

    for (const shape of chunk.shapes) {
      if (shape.type === 'polygon' && shape.points?.length >= 2) {
        const poly = new fabric.Polyline(shape.points, {
          fill: 'transparent',
          stroke: CANVAS_COLORS.POLYGON_STROKE,
          strokeWidth: 0.5,
          selectable: false,
          evented: false,
          objectCaching: true,
        });

        (poly as CustomFabricObject).customData = {
          id: shape.id,
          type: 'polygon',
          isFromGeometry: true,
          chunkId,
        };

        objects.push(poly);
      }
    }

    chunk.fabricObjects = objects;
    chunk.isRendered = true;

    this.canvas.renderOnAddRemove = false;
    objects.forEach(obj => this.canvas!.add(obj));
    this.canvas.renderOnAddRemove = true;

    this.stats.update(s => ({
      ...s,
      renderedShapes: s.renderedShapes + objects.length,
    }));
  }

  private unrenderChunk(chunkId: string): void {
    const chunk = this.chunks.get(chunkId);
    if (!chunk || !chunk.isRendered || !this.canvas) return;

    this.canvas.renderOnAddRemove = false;
    chunk.fabricObjects.forEach(obj => this.canvas!.remove(obj));
    this.canvas.renderOnAddRemove = true;

    this.stats.update(s => ({
      ...s,
      renderedShapes: s.renderedShapes - chunk.fabricObjects.length,
    }));

    chunk.fabricObjects = [];
    chunk.isRendered = false;
  }

  private clearAllChunks(): void {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }

    this.renderQueue = [];
    this.isRendering = false;

    if (this.canvas) {
      this.canvas.renderOnAddRemove = false;
      for (const chunk of this.chunks.values()) {
        chunk.fabricObjects.forEach(obj => this.canvas!.remove(obj));
      }
      this.canvas.renderOnAddRemove = true;
      this.canvas.requestRenderAll();
    }

    this.chunks.clear();
    this.stats.set({
      totalShapes: 0,
      renderedShapes: 0,
      visibleShapes: 0,
      fps: 0,
      lastRenderTime: 0,
    });
  }

  getAllRenderedObjects(): fabric.FabricObject[] {
    const objects: fabric.FabricObject[] = [];
    for (const chunk of this.chunks.values()) {
      if (chunk.isRendered) {
        objects.push(...chunk.fabricObjects);
      }
    }
    return objects;
  }

  setChunksOpacity(opacity: number): void {
    for (const chunk of this.chunks.values()) {
      if (chunk.isRendered) {
        chunk.fabricObjects.forEach(obj => obj.set({ opacity }));
      }
    }
    this.canvas?.requestRenderAll();
  }

  setChunksVisibility(visible: boolean): void {
    for (const chunk of this.chunks.values()) {
      if (chunk.isRendered) {
        chunk.fabricObjects.forEach(obj => obj.set({ visible }));
      }
    }
    this.canvas?.requestRenderAll();
  }

  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
    }
    this.clearAllChunks();
  }
}
