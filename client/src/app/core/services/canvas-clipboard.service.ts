/**
 * Canvas Clipboard Service
 * Manages copy/paste operations for Fabric.js canvas objects.
 * Extracted from EditorCanvasComponent for readability.
 */
import { Injectable } from '@angular/core';
import { fabric } from 'fabric';
import { CustomFabricObject } from '@utils/canvas.utils';

@Injectable()
export class CanvasClipboardService {
  private clipboard: fabric.Object[] = [];

  /** Copy currently selected objects to clipboard */
  public copy(canvas: fabric.Canvas): void {
    this.clipboard = [];
    canvas
      .getActiveObjects()
      .forEach((o: fabric.Object) =>
        o.clone().then((c: fabric.Object) => this.clipboard.push(c)),
      );
  }

  /** Paste clipboard objects onto the canvas (offset by 20px) */
  public paste(canvas: fabric.Canvas): void {
    if (this.clipboard.length === 0) return;

    this.clipboard.forEach((o: fabric.Object, i: number) =>
      o.clone().then((c: fabric.Object) => {
        c.set({ left: (c.left || 0) + 20, top: (c.top || 0) + 20 });
        (c as CustomFabricObject).customData = {
          id: `pasted-${Date.now()}-${i}`,
        };
        canvas.add(c);
      }),
    );
  }

  /** Check if clipboard has content */
  public get hasContent(): boolean {
    return this.clipboard.length > 0;
  }

  /** Clear clipboard */
  public clear(): void {
    this.clipboard = [];
  }
}
