import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TranslocoModule } from '@jsverse/transloco';
import { EditorStore } from '@stores/editor';

@Component({
  selector: 'app-zoom-controls',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TooltipModule,
    TranslocoModule,
    DecimalPipe,
  ],
  templateUrl: './zoom-controls.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZoomControlsComponent {
  public readonly store = inject(EditorStore);

  public zoomIn(): void {
    this.store.setZoom(this.store.zoom() + 0.1);
  }

  public zoomOut(): void {
    this.store.setZoom(this.store.zoom() - 0.1);
  }

  public resetView(): void {
    this.store.resetView();
  }
}
