import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TranslocoModule } from '@jsverse/transloco';
import { EditorStore } from '@stores/editor';

@Component({
  selector: 'app-grid-controls',
  standalone: true,
  imports: [CommonModule, ButtonModule, TooltipModule, TranslocoModule],
  templateUrl: './grid-controls.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridControlsComponent {
  public readonly store = inject(EditorStore);

  public toggleGrid(): void {
    this.store.toggleGrid();
  }

  public toggleSnapToGrid(): void {
    this.store.toggleSnapToGrid();
  }
}
