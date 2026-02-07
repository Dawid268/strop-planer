import { Injectable, inject, signal } from '@angular/core';
import { fabric } from 'fabric';
import { CanvasChunkService } from './canvas-chunk.service';
import { CanvasRenderQueueService } from './canvas-render-queue.service';

/**
 * Manages viewport visibility tracking and chunk visibility updates
 */
@Injectable()
export class CanvasVisibilityService {
  private readonly chunkService = inject(CanvasChunkService);
  private readonly renderQueue = inject(CanvasRenderQueueService);

  private canvas: fabric.Canvas | null = null;
  private viewportUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
  private frameCount = 0;
  private fpsUpdateTime = 0;

  readonly fps = signal(0);

  public setCanvas(canvas: fabric.Canvas): void {
    this.canvas = canvas;
    this.setupViewportTracking();
  }

  private setupViewportTracking(): void {
    if (!this.canvas) return;

    this.canvas.on('after:render', () => {
      this.updateFps();
    });

    const debouncedViewportUpdate = (): void => {
      if (this.viewportUpdateTimeout) {
        clearTimeout(this.viewportUpdateTimeout);
      }
      this.viewportUpdateTimeout = setTimeout(() => {
        this.updateVisibleChunks();
      }, 50);
    };

    this.canvas.on('mouse:wheel', debouncedViewportUpdate);
    this.canvas.on('mouse:move', (e) => {
      if (
        (e.e as MouseEvent).buttons === 1 ||
        (e.e as MouseEvent).buttons === 4
      ) {
        debouncedViewportUpdate();
      }
    });
  }

  private updateFps(): void {
    const now = performance.now();
    this.frameCount++;

    if (now - this.fpsUpdateTime >= 1000) {
      const fps = Math.round(
        (this.frameCount * 1000) / (now - this.fpsUpdateTime),
      );
      this.fps.set(fps);
      this.frameCount = 0;
      this.fpsUpdateTime = now;
    }
  }

  public updateVisibleChunks(): void {
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

    const chunks = this.chunkService.getAllChunks();

    for (const [chunkId, chunk] of chunks) {
      const isVisible = !(
        chunk.bounds.maxX < viewMinX - margin ||
        chunk.bounds.minX > viewMaxX + margin ||
        chunk.bounds.maxY < viewMinY - margin ||
        chunk.bounds.minY > viewMaxY + margin
      );

      if (isVisible && !chunk.isRendered) {
        this.renderQueue.queueChunkRender(chunkId);
      } else if (!isVisible && chunk.isRendered) {
        this.chunkService.unrenderChunk(chunkId);
      }

      this.chunkService.setChunkVisibility(chunkId, isVisible);
    }

    this.chunkService.updateVisibleCount();
  }

  public destroy(): void {
    if (this.viewportUpdateTimeout) {
      clearTimeout(this.viewportUpdateTimeout);
      this.viewportUpdateTimeout = null;
    }
  }
}
