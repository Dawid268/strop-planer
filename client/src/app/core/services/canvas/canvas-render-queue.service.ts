import { Injectable, inject } from '@angular/core';
import { fabric } from 'fabric';
import { CanvasChunkService } from './canvas-chunk.service';

const RENDER_BATCH_SIZE = 100;
const RENDER_DELAY_MS = 16;

/**
 * Manages render queue for progressive chunk rendering
 */
@Injectable()
export class CanvasRenderQueueService {
  private readonly chunkService = inject(CanvasChunkService);

  private canvas: fabric.Canvas | null = null;
  private renderQueue: string[] = [];
  private isRendering = false;
  private frameId: number | null = null;

  public setCanvas(canvas: fabric.Canvas): void {
    this.canvas = canvas;
  }

  public queueChunkRender(chunkId: string): void {
    if (!this.renderQueue.includes(chunkId)) {
      this.renderQueue.push(chunkId);
    }
    this.processRenderQueue();
  }

  public clearQueue(): void {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.renderQueue = [];
    this.isRendering = false;
  }

  public isQueueEmpty(): boolean {
    return this.renderQueue.length === 0;
  }

  private processRenderQueue(): void {
    if (this.isRendering || this.renderQueue.length === 0) return;

    this.isRendering = true;

    const processNextBatch = (): void => {
      const startTime = performance.now();
      let processed = 0;

      while (this.renderQueue.length > 0 && processed < RENDER_BATCH_SIZE) {
        const chunkId = this.renderQueue.shift()!;
        this.chunkService.renderChunk(chunkId);
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

  public destroy(): void {
    this.clearQueue();
  }
}
