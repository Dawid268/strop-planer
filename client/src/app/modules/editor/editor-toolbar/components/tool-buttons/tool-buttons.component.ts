import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TranslocoModule } from '@jsverse/transloco';
import { EditorStore } from '@stores/editor.store';
import type { EditorTool } from '@models/editor.models';

@Component({
  selector: 'app-tool-buttons',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SelectButtonModule,
    ButtonModule,
    TooltipModule,
    TranslocoModule,
  ],
  templateUrl: './tool-buttons.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolButtonsComponent {
  public readonly store = inject(EditorStore);

  public readonly toolOptions = [
    {
      value: 'select',
      icon: 'pi pi-arrow-up-left',
      tooltipKey: 'editor.tools.select',
    },
    { value: 'pan', icon: 'pi pi-arrows-alt', tooltipKey: 'editor.tools.pan' },
    {
      value: 'add-panel',
      icon: 'pi pi-th-large',
      tooltipKey: 'editor.tools.addPanel',
    },
    {
      value: 'add-prop',
      icon: 'pi pi-stop',
      tooltipKey: 'editor.tools.addProp',
    },
    {
      value: 'draw-beam',
      icon: 'pi pi-pencil',
      tooltipKey: 'editor.tools.drawBeam',
    },
    {
      value: 'draw-polygon',
      icon: 'pi pi-pencil',
      tooltipKey: 'editor.tools.drawPolygon',
    },
    {
      value: 'draw-slab-manual',
      icon: 'pi pi-pencil',
      tooltipKey: 'editor.tools.drawSlab',
    },
    {
      value: 'trace-slab-auto',
      icon: 'pi pi-magic',
      tooltipKey: 'editor.tools.autoTraceSlab',
    },
    {
      value: 'trace-slab',
      icon: 'pi pi-map-marker',
      tooltipKey: 'editor.tools.traceSlab',
    },
  ];

  public setTool(tool: EditorTool): void {
    if (tool) {
      this.store.setActiveTool(tool);
    }
  }

  public generateAutoLayout(): void {
    this.store.generateAutoLayout();
  }

  public autoTracePdf(): void {
    this.store.autoTracePdf();
  }
}
