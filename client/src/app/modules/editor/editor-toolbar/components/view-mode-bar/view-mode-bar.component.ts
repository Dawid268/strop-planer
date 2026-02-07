import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectButtonModule } from 'primeng/selectbutton';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TranslocoModule } from '@jsverse/transloco';
import { EditorStore } from '@stores/editor.store';
import type { ViewMode } from '@models/editor.models';

@Component({
  selector: 'app-view-mode-bar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SelectButtonModule,
    ButtonModule,
    TooltipModule,
    TranslocoModule,
  ],
  templateUrl: './view-mode-bar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewModeBarComponent {
  public readonly store = inject(EditorStore);

  public readonly viewModeOptions = [
    { labelKey: 'editor.viewModes.full', value: 'full', icon: 'pi pi-image' },
    { labelKey: 'editor.viewModes.slab', value: 'slab', icon: 'pi pi-clone' },
  ];

  public setViewMode(mode: ViewMode): void {
    if (mode) {
      this.store.setViewMode(mode);
    }
  }

  public generateOptimalLayout(): void {
    this.store.generateOptimalLayout();
  }
}
