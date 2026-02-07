import {
  Component,
  inject,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { EditorStore } from '@stores/editor';
import { EditorLayer } from '@models/project.model';

@Component({
  selector: 'app-selection-actions',
  standalone: true,
  imports: [CommonModule, ButtonModule],
  templateUrl: './selection-actions.component.html',
  styleUrls: ['./selection-actions.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectionActionsComponent {
  public readonly store = inject(EditorStore);

  public readonly editableLayers = input<EditorLayer[]>([]);
  public readonly openNewLayerDialog = output<void>();

  public onSaveAsLayer(): void {
    this.openNewLayerDialog.emit();
  }
}
