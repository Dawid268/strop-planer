import { Injectable, signal, computed } from '@angular/core';
import { Subject } from 'rxjs';

export interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
  width: number;
  height: number;
}

export interface ViewportBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 10;

@Injectable()
export class ViewportService {
  private readonly _zoom = signal(1);
  private readonly _panX = signal(0);
  private readonly _panY = signal(0);
  private readonly _width = signal(1920);
  private readonly _height = signal(1080);

  readonly zoom = this._zoom.asReadonly();
  readonly panX = this._panX.asReadonly();
  readonly panY = this._panY.asReadonly();

  readonly viewportBounds = computed<ViewportBounds>(() => {
    const z = this._zoom();
    const px = this._panX();
    const py = this._panY();
    const w = this._width();
    const h = this._height();

    return {
      minX: -px / z,
      minY: -py / z,
      maxX: (-px + w) / z,
      maxY: (-py + h) / z,
    };
  });

  readonly zoomPercent = computed(() => Math.round(this._zoom() * 100));

  private boundsUpdate$ = new Subject<void>();

  private onBoundsChangeCallbacks: ((bounds: ViewportBounds) => void)[] = [];
  private onViewChangeCallbacks: ((
    zoom: number,
    x: number,
    y: number,
  ) => void)[] = [];

  constructor() {
    // Throttling removed to eliminate latency.
    // Signals and requestRenderAll in component handle visual consistency.
  }

  setZoom(zoom: number, point?: { x: number; y: number }): void {
    this.applyZoom(zoom, point);
  }

  private applyZoom(zoom: number, point?: { x: number; y: number }): void {
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    const oldZoom = this._zoom();

    if (Math.abs(clampedZoom - oldZoom) < 0.001) return;

    if (point) {
      // Convert screen point to world coordinates before zoom
      const worldX = (point.x - this._panX()) / oldZoom;
      const worldY = (point.y - this._panY()) / oldZoom;

      // After zoom, the world point should remain at the same screen position
      // screenPos = worldPos * newZoom + newPan
      // newPan = screenPos - worldPos * newZoom
      const newPanX = point.x - worldX * clampedZoom;
      const newPanY = point.y - worldY * clampedZoom;

      this._panX.set(newPanX);
      this._panY.set(newPanY);
    }

    this._zoom.set(clampedZoom);
    this.onViewChangeCallbacks.forEach((cb) =>
      cb(clampedZoom, this._panX(), this._panY()),
    );
    this.boundsUpdate$.next();
  }

  zoomIn(factor = 1.2): void {
    this.setZoom(this._zoom() * factor);
  }

  zoomOut(factor = 1.2): void {
    this.setZoom(this._zoom() / factor);
  }

  zoomToFit(contentBounds: ViewportBounds, padding = 50): void {
    const contentWidth = contentBounds.maxX - contentBounds.minX;
    const contentHeight = contentBounds.maxY - contentBounds.minY;

    if (contentWidth <= 0 || contentHeight <= 0) return;

    const availableWidth = this._width() - padding * 2;
    const availableHeight = this._height() - padding * 2;

    const zoomX = availableWidth / contentWidth;
    const zoomY = availableHeight / contentHeight;
    const newZoom = Math.min(zoomX, zoomY, MAX_ZOOM);

    const centerX = (contentBounds.minX + contentBounds.maxX) / 2;
    const centerY = (contentBounds.minY + contentBounds.maxY) / 2;

    this._zoom.set(newZoom);
    this._panX.set(this._width() / 2 - centerX * newZoom);
    this._panY.set(this._height() / 2 - centerY * newZoom);

    this.onViewChangeCallbacks.forEach((cb) =>
      cb(newZoom, this._panX(), this._panY()),
    );
    this.boundsUpdate$.next();
  }

  resetView(): void {
    this._zoom.set(1);
    this._panX.set(0);
    this._panY.set(0);
    this.onViewChangeCallbacks.forEach((cb) => cb(1, 0, 0));
    this.boundsUpdate$.next();
  }

  setPan(x: number, y: number): void {
    this.applyPan(x, y);
  }

  private applyPan(x: number, y: number): void {
    if (this._panX() === x && this._panY() === y) return;

    this._panX.set(x);
    this._panY.set(y);
    this.onViewChangeCallbacks.forEach((cb) => cb(this._zoom(), x, y));
    this.boundsUpdate$.next();
  }

  panBy(deltaX: number, deltaY: number): void {
    this.setPan(this._panX() + deltaX, this._panY() + deltaY);
  }

  setViewportSize(width: number, height: number): void {
    if (this._width() === width && this._height() === height) return;
    this._width.set(width);
    this._height.set(height);
    this.boundsUpdate$.next();
  }

  onViewChange(
    callback: (zoom: number, x: number, y: number) => void,
  ): () => void {
    this.onViewChangeCallbacks.push(callback);
    return () => {
      const idx = this.onViewChangeCallbacks.indexOf(callback);
      if (idx > -1) this.onViewChangeCallbacks.splice(idx, 1);
    };
  }

  /** @deprecated Use onViewChange instead */
  onZoomChange(callback: (zoom: number) => void): () => void {
    return this.onViewChange((z) => callback(z));
  }

  /** @deprecated Use onViewChange instead */
  onPanChange(callback: (x: number, y: number) => void): () => void {
    return this.onViewChange((_, x, y) => callback(x, y));
  }

  onBoundsChange(callback: (bounds: ViewportBounds) => void): () => void {
    this.onBoundsChangeCallbacks.push(callback);
    return () => {
      const idx = this.onBoundsChangeCallbacks.indexOf(callback);
      if (idx > -1) this.onBoundsChangeCallbacks.splice(idx, 1);
    };
  }

  isPointInViewport(x: number, y: number, margin = 0): boolean {
    const bounds = this.viewportBounds();
    return (
      x >= bounds.minX - margin &&
      x <= bounds.maxX + margin &&
      y >= bounds.minY - margin &&
      y <= bounds.maxY + margin
    );
  }

  isRectInViewport(
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
    margin = 0,
  ): boolean {
    const bounds = this.viewportBounds();
    return !(
      maxX < bounds.minX - margin ||
      minX > bounds.maxX + margin ||
      maxY < bounds.minY - margin ||
      minY > bounds.maxY + margin
    );
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const z = this._zoom();
    return {
      x: (screenX - this._panX()) / z,
      y: (screenY - this._panY()) / z,
    };
  }

  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const z = this._zoom();
    return {
      x: worldX * z + this._panX(),
      y: worldY * z + this._panY(),
    };
  }
}
