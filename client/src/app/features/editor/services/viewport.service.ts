import { Injectable, signal, computed, inject, DestroyRef } from '@angular/core';
import { Subject, throttleTime, debounceTime, animationFrameScheduler } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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
const ZOOM_THROTTLE_MS = 16;
const PAN_THROTTLE_MS = 16;
const BOUNDS_DEBOUNCE_MS = 50;

@Injectable()
export class ViewportService {
  private readonly destroyRef = inject(DestroyRef);

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

  private zoomChange$ = new Subject<{ zoom: number; point?: { x: number; y: number } }>();
  private panChange$ = new Subject<{ x: number; y: number }>();
  private boundsUpdate$ = new Subject<void>();

  private onZoomChangeCallbacks: ((zoom: number) => void)[] = [];
  private onPanChangeCallbacks: ((x: number, y: number) => void)[] = [];
  private onBoundsChangeCallbacks: ((bounds: ViewportBounds) => void)[] = [];

  constructor() {
    this.zoomChange$
      .pipe(
        throttleTime(ZOOM_THROTTLE_MS, animationFrameScheduler, { leading: true, trailing: true }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ zoom, point }) => {
        this.applyZoom(zoom, point);
      });

    this.panChange$
      .pipe(
        throttleTime(PAN_THROTTLE_MS, animationFrameScheduler, { leading: true, trailing: true }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ x, y }) => {
        this.applyPan(x, y);
      });

    this.boundsUpdate$
      .pipe(
        debounceTime(BOUNDS_DEBOUNCE_MS),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        const bounds = this.viewportBounds();
        this.onBoundsChangeCallbacks.forEach(cb => cb(bounds));
      });
  }

  setZoom(zoom: number, point?: { x: number; y: number }): void {
    this.zoomChange$.next({ zoom, point });
  }

  private applyZoom(zoom: number, point?: { x: number; y: number }): void {
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
    const oldZoom = this._zoom();

    if (Math.abs(clampedZoom - oldZoom) < 0.001) return;

    if (point) {
      const zoomRatio = clampedZoom / oldZoom;
      const newPanX = point.x - (point.x - this._panX()) * zoomRatio;
      const newPanY = point.y - (point.y - this._panY()) * zoomRatio;
      this._panX.set(newPanX);
      this._panY.set(newPanY);
    }

    this._zoom.set(clampedZoom);
    this.onZoomChangeCallbacks.forEach(cb => cb(clampedZoom));
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

    this.onZoomChangeCallbacks.forEach(cb => cb(newZoom));
    this.onPanChangeCallbacks.forEach(cb => cb(this._panX(), this._panY()));
    this.boundsUpdate$.next();
  }

  resetView(): void {
    this._zoom.set(1);
    this._panX.set(0);
    this._panY.set(0);
    this.onZoomChangeCallbacks.forEach(cb => cb(1));
    this.onPanChangeCallbacks.forEach(cb => cb(0, 0));
    this.boundsUpdate$.next();
  }

  setPan(x: number, y: number): void {
    this.panChange$.next({ x, y });
  }

  private applyPan(x: number, y: number): void {
    if (this._panX() === x && this._panY() === y) return;

    this._panX.set(x);
    this._panY.set(y);
    this.onPanChangeCallbacks.forEach(cb => cb(x, y));
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

  onZoomChange(callback: (zoom: number) => void): () => void {
    this.onZoomChangeCallbacks.push(callback);
    return () => {
      const idx = this.onZoomChangeCallbacks.indexOf(callback);
      if (idx > -1) this.onZoomChangeCallbacks.splice(idx, 1);
    };
  }

  onPanChange(callback: (x: number, y: number) => void): () => void {
    this.onPanChangeCallbacks.push(callback);
    return () => {
      const idx = this.onPanChangeCallbacks.indexOf(callback);
      if (idx > -1) this.onPanChangeCallbacks.splice(idx, 1);
    };
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
    margin = 0
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
