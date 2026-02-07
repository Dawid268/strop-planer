import { Injectable, signal } from '@angular/core';
import { fabric } from 'fabric';
import { CustomFabricObject, CANVAS_COLORS } from '@utils/canvas.utils';
import type { GeometryShape } from '@models/geometry.models';

export interface ChunkBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface RenderChunk {
  id: string;
  shapes: GeometryShape[];
  fabricObjects: fabric.FabricObject[];
  bounds: ChunkBounds;
  isVisible: boolean;
  isRendered: boolean;
}

export interface ChunkStats {
  totalShapes: number;
  renderedShapes: number;
  visibleShapes: number;
}

/**
 * Manages geometry chunks - storage, rendering, and lifecycle
 */
@Injectable()
export class CanvasChunkService {
  private chunks: Map<string, RenderChunk> = new Map();
  private canvas: fabric.Canvas | null = null;

  readonly stats = signal<ChunkStats>({
    totalShapes: 0,
    renderedShapes: 0,
    visibleShapes: 0,
  });

  public setCanvas(canvas: fabric.Canvas): void {
    this.canvas = canvas;
  }

  public addChunk(chunkId: string, shapes: GeometryShape[]): void {
    const bounds = this.calculateBounds(shapes);

    const chunk: RenderChunk = {
      id: chunkId,
      shapes,
      fabricObjects: [],
      bounds,
      isVisible: false,
      isRendered: false,
    };

    this.chunks.set(chunkId, chunk);

    this.stats.update((s) => ({
      ...s,
      totalShapes: s.totalShapes + shapes.length,
    }));
  }

  public getChunk(chunkId: string): RenderChunk | undefined {
    return this.chunks.get(chunkId);
  }

  public getAllChunks(): Map<string, RenderChunk> {
    return this.chunks;
  }

  public renderChunk(chunkId: string): number {
    const chunk = this.chunks.get(chunkId);
    if (!chunk || chunk.isRendered || !this.canvas) return 0;

    const objects: fabric.FabricObject[] = [];

    for (const shape of chunk.shapes) {
      if (
        shape.type === 'polygon' &&
        shape.points &&
        shape.points.length >= 2
      ) {
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
    objects.forEach((obj) => this.canvas!.add(obj));
    this.canvas.renderOnAddRemove = true;

    this.stats.update((s) => ({
      ...s,
      renderedShapes: s.renderedShapes + objects.length,
    }));

    return objects.length;
  }

  public unrenderChunk(chunkId: string): void {
    const chunk = this.chunks.get(chunkId);
    if (!chunk || !chunk.isRendered || !this.canvas) return;

    this.canvas.renderOnAddRemove = false;
    chunk.fabricObjects.forEach((obj) => this.canvas!.remove(obj));
    this.canvas.renderOnAddRemove = true;

    this.stats.update((s) => ({
      ...s,
      renderedShapes: s.renderedShapes - chunk.fabricObjects.length,
    }));

    chunk.fabricObjects = [];
    chunk.isRendered = false;
  }

  public setChunkVisibility(chunkId: string, isVisible: boolean): void {
    const chunk = this.chunks.get(chunkId);
    if (chunk) {
      chunk.isVisible = isVisible;
    }
  }

  public updateVisibleCount(): void {
    let visibleCount = 0;
    for (const chunk of this.chunks.values()) {
      if (chunk.isVisible) {
        visibleCount += chunk.shapes.length;
      }
    }
    this.stats.update((s) => ({ ...s, visibleShapes: visibleCount }));
  }

  public clearAllChunks(): void {
    if (this.canvas) {
      this.canvas.renderOnAddRemove = false;
      for (const chunk of this.chunks.values()) {
        chunk.fabricObjects.forEach((obj) => this.canvas!.remove(obj));
      }
      this.canvas.renderOnAddRemove = true;
      this.canvas.requestRenderAll();
    }

    this.chunks.clear();
    this.stats.set({
      totalShapes: 0,
      renderedShapes: 0,
      visibleShapes: 0,
    });
  }

  public getAllRenderedObjects(): fabric.FabricObject[] {
    const objects: fabric.FabricObject[] = [];
    for (const chunk of this.chunks.values()) {
      if (chunk.isRendered) {
        objects.push(...chunk.fabricObjects);
      }
    }
    return objects;
  }

  public setChunksOpacity(opacity: number): void {
    for (const chunk of this.chunks.values()) {
      if (chunk.isRendered) {
        chunk.fabricObjects.forEach((obj) => obj.set({ opacity }));
      }
    }
    this.canvas?.requestRenderAll();
  }

  public setChunksVisibility(visible: boolean): void {
    for (const chunk of this.chunks.values()) {
      if (chunk.isRendered) {
        chunk.fabricObjects.forEach((obj) => obj.set({ visible }));
      }
    }
    this.canvas?.requestRenderAll();
  }

  private calculateBounds(shapes: GeometryShape[]): ChunkBounds {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

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
}
