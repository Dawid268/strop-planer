import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { EditorStore } from '@stores/editor';

@Component({
  selector: 'app-properties-panel',
  standalone: true,
  imports: [CommonModule, TranslocoModule, DecimalPipe],
  templateUrl: './properties-panel.component.html',
  styleUrls: ['./properties-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropertiesPanelComponent {
  public readonly store = inject(EditorStore);
}
