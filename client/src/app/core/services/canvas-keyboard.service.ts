/**
 * Canvas Keyboard Service
 * Handles keyboard shortcuts for the editor canvas.
 * Extracted from EditorCanvasComponent for readability.
 */
import { Injectable, inject } from '@angular/core';
import { fabric } from 'fabric';
import { EditorStore } from '@stores/editor';
import { CanvasDrawingService } from '@services/canvas-drawing.service';
import { CanvasInteractionService } from '@services/canvas-interaction.service';
import { CanvasHistoryService } from '@services/canvas-history.service';
import { CanvasClipboardService } from '@services/canvas-clipboard.service';
import type { EditorTool } from '@models/editor.models';

/** Keyboard shortcut → tool mapping */
const TOOL_SHORTCUTS: Record<string, EditorTool> = {
  v: 'select',
  h: 'pan',
  b: 'draw-beam',
  m: 'trace-slab',
  p: 'draw-polygon',
  s: 'add-prop',
};

@Injectable()
export class CanvasKeyboardService {
  private readonly store = inject(EditorStore);
  private readonly drawing = inject(CanvasDrawingService);
  private readonly interaction = inject(CanvasInteractionService);
  private readonly history = inject(CanvasHistoryService);
  private readonly clipboard = inject(CanvasClipboardService);

  /**
   * Handle a keydown event. Returns true if the event was consumed.
   */
  public handleKeyDown(
    e: KeyboardEvent,
    canvas: fabric.Canvas | null,
    callbacks: {
      deleteSelected: () => void;
      rotateSelected: () => void;
      selectAll: () => void;
    },
  ): boolean {
    if (!canvas) return false;

    // Ignore events from input fields
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return false;

    const key = e.key.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;

    // Delete / Backspace → delete selected
    if (key === 'delete' || key === 'backspace') {
      e.preventDefault();
      callbacks.deleteSelected();
      return true;
    }

    // Escape → cancel current operation
    if (key === 'escape') {
      this.drawing.clearDrawingPreviews(canvas);
      canvas.discardActiveObject();
      this.interaction.showContextToolbar.set(false);
      this.store.setActiveTool('select');
      return true;
    }

    // R → rotate selected 90°
    if (key === 'r' && !ctrl) {
      e.preventDefault();
      callbacks.rotateSelected();
      return true;
    }

    // Ctrl+C → copy
    if (key === 'c' && ctrl) {
      e.preventDefault();
      this.clipboard.copy(canvas);
      return true;
    }

    // Ctrl+V → paste
    if (key === 'v' && ctrl) {
      e.preventDefault();
      this.clipboard.paste(canvas);
      return true;
    }

    // Ctrl+A → select all
    if (key === 'a' && ctrl) {
      e.preventDefault();
      callbacks.selectAll();
      return true;
    }

    // Ctrl+Z / Ctrl+Shift+Z → undo / redo
    if (key === 'z' && ctrl) {
      e.preventDefault();
      if (shift) {
        this.history.redo(canvas);
      } else {
        this.history.undo(canvas);
      }
      return true;
    }

    // Tool shortcuts (single key, no ctrl)
    if (!ctrl && key in TOOL_SHORTCUTS) {
      this.store.setActiveTool(TOOL_SHORTCUTS[key]);
      return true;
    }

    return false;
  }
}
