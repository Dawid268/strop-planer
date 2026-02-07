import { Injectable } from '@angular/core';
import { fabric } from 'fabric';

@Injectable()
export class CanvasHistoryService {
  private historyStack: string[] = [];
  private historyIndex = -1;
  private readonly MAX_HISTORY = 50;
  private isRestoring = false;

  public saveState(canvas: fabric.Canvas | null): void {
    if (!canvas || this.isRestoring) return;

    const json = JSON.stringify(canvas.toJSON());

    // Remove any states after current index (for new branch)
    if (this.historyIndex < this.historyStack.length - 1) {
      this.historyStack.splice(this.historyIndex + 1);
    }

    // Add new state
    this.historyStack.push(json);
    this.historyIndex = this.historyStack.length - 1;

    // Limit history size
    if (this.historyStack.length > this.MAX_HISTORY) {
      this.historyStack.shift();
      this.historyIndex--;
    }
  }

  public async undo(canvas: fabric.Canvas | null): Promise<void> {
    if (!canvas || this.historyIndex <= 0) return;

    this.isRestoring = true;
    this.historyIndex--;

    const state = this.historyStack[this.historyIndex];
    await canvas.loadFromJSON(state);
    canvas.requestRenderAll();
    this.isRestoring = false;
  }

  public async redo(canvas: fabric.Canvas | null): Promise<void> {
    if (!canvas || this.historyIndex >= this.historyStack.length - 1) return;

    this.isRestoring = true;
    this.historyIndex++;

    const state = this.historyStack[this.historyIndex];
    await canvas.loadFromJSON(state);
    canvas.requestRenderAll();
    this.isRestoring = false;
  }

  public clear(): void {
    this.historyStack = [];
    this.historyIndex = -1;
  }
}
