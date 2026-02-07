import { Injectable, signal, NgZone, inject, computed } from '@angular/core';
import { fabric } from 'fabric';
import { getPolygonPoints } from '@utils/canvas.utils';
import { ErrorHandlerService } from './error-handler.service';
import {
  CanvasChunkService,
  CanvasRenderQueueService,
  CanvasVisibilityService,
} from './canvas';
import type {
  GeometryShape,
  RawGeometry,
  ChunkData,
  WorkerMessage,
  WorkerProgressData,
  WorkerCompleteData,
} from '@models/geometry.models';

export interface RenderStats {
  totalShapes: number;
  renderedShapes: number;
  visibleShapes: number;
  fps: number;
  lastRenderTime: number;
}

const CHUNK_SIZE = 500;

/**
 * Orchestrates geometry loading and rendering using specialized sub-services
 */
@Injectable()
export class CanvasRendererService {
  private readonly ngZone = inject(NgZone);
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly chunkService = inject(CanvasChunkService);
  private readonly renderQueue = inject(CanvasRenderQueueService);
  private readonly visibilityService = inject(CanvasVisibilityService);

  private worker: Worker | null = null;

  readonly isLoading = signal(false);
  readonly loadingProgress = signal(0);
  readonly loadingMessage = signal('');

  readonly stats = computed<RenderStats>(() => {
    const chunkStats = this.chunkService.stats();
    return {
      ...chunkStats,
      fps: this.visibilityService.fps(),
      lastRenderTime: 0,
    };
  });

  public setCanvas(canvas: fabric.Canvas): void {
    this.chunkService.setCanvas(canvas);
    this.renderQueue.setCanvas(canvas);
    this.visibilityService.setCanvas(canvas);
  }

  public loadShapesWithWorker(rawGeometry: RawGeometry): void {
    this.isLoading.set(true);
    this.loadingProgress.set(0);
    this.loadingMessage.set('Inicjalizacja...');
    this.clearAll();

    if (typeof Worker !== 'undefined') {
      this.worker = new Worker(
        new URL('../../shared/utils/geometry.worker', import.meta.url),
        { type: 'module' },
      );

      this.worker.onmessage = ({ data }: MessageEvent<WorkerMessage>): void => {
        this.ngZone.run(() => {
          switch (data.type) {
            case 'chunk':
              this.handleChunkReceived(data.data as ChunkData);
              break;
            case 'progress': {
              const progressData = data.data as WorkerProgressData;
              this.loadingProgress.set(
                (progressData.processed / progressData.total) * 100,
              );
              this.loadingMessage.set(progressData.message);
              break;
            }
            case 'complete':
              this.handleLoadingComplete(data.data as WorkerCompleteData);
              break;
            case 'error':
              this.errorHandler.handleError(
                new Error(data.error ?? 'Unknown worker error'),
              );
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

  private handleChunkReceived(chunkData: ChunkData): void {
    const chunkId = `chunk-${chunkData.chunkIndex}`;
    this.chunkService.addChunk(chunkId, chunkData.shapes);
    this.loadingProgress.set(chunkData.progress);
  }

  private handleLoadingComplete(data: WorkerCompleteData): void {
    this.isLoading.set(false);
    this.loadingProgress.set(100);
    this.loadingMessage.set(`Załadowano ${data.totalShapes} elementów`);

    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.visibilityService.updateVisibleChunks();
  }

  private loadShapesSync(rawGeometry: RawGeometry): void {
    const polygons = rawGeometry?.lines?.length
      ? rawGeometry.lines.map((l) => [l.a, l.b])
      : rawGeometry?.polygons || [];
    const total = polygons.length;

    for (let i = 0; i < total; i += CHUNK_SIZE) {
      const chunkPolygons = polygons.slice(i, Math.min(i + CHUNK_SIZE, total));
      const shapes: GeometryShape[] = [];

      for (let idx = 0; idx < chunkPolygons.length; idx++) {
        const globalIdx = i + idx;
        const points = getPolygonPoints(chunkPolygons[idx]);
        if (points.length >= 2) {
          shapes.push({
            id: `ai-poly-${globalIdx}`,
            type: 'polygon',
            points: points.map((p) => ({ x: p.x, y: p.y })),
            x: 0,
            y: 0,
          });
        }
      }

      this.handleChunkReceived({
        chunkIndex: Math.floor(i / CHUNK_SIZE),
        shapes,
        progress: Math.round(((i + CHUNK_SIZE) / total) * 100),
      });
    }

    this.handleLoadingComplete({ totalShapes: total });
  }

  private clearAll(): void {
    this.renderQueue.clearQueue();
    this.chunkService.clearAllChunks();
  }

  public getAllRenderedObjects(): fabric.FabricObject[] {
    return this.chunkService.getAllRenderedObjects();
  }

  public setChunksOpacity(opacity: number): void {
    this.chunkService.setChunksOpacity(opacity);
  }

  public setChunksVisibility(visible: boolean): void {
    this.chunkService.setChunksVisibility(visible);
  }

  public destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.renderQueue.destroy();
    this.visibilityService.destroy();
    this.clearAll();
  }
}
