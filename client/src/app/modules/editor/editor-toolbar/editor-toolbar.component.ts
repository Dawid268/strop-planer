import {
  Component,
  inject,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { DividerModule } from 'primeng/divider';
import { MenuModule } from 'primeng/menu';
import { TranslocoModule } from '@jsverse/transloco';
import { EditorStore } from '@stores/editor.store';
import {
  ToolButtonsComponent,
  ZoomControlsComponent,
  GridControlsComponent,
  ViewModeBarComponent,
} from './components';

@Component({
  selector: 'app-editor-toolbar',
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    TooltipModule,
    DividerModule,
    TranslocoModule,
    MenuModule,
    ToolButtonsComponent,
    ZoomControlsComponent,
    GridControlsComponent,
    ViewModeBarComponent,
  ],
  templateUrl: './editor-toolbar.component.html',
  styleUrls: ['./editor-toolbar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorToolbarComponent {
  public readonly store = inject(EditorStore);
  public selectedTabId: string | null = null;

  public tabMenuItems = [
    {
      label: 'Zmień nazwę',
      icon: 'pi pi-pencil',
      command: (): void => {
        if (this.selectedTabId) {
          const tab = this.store
            .tabs()
            .find((t) => t.id === this.selectedTabId);
          const newName = prompt('Nowa nazwa strony:', tab?.name);
          if (newName) {
            this.store.renameTab(this.selectedTabId, newName);
          }
        }
      },
    },
    {
      label: 'Usuń',
      icon: 'pi pi-trash',
      command: (): void => {
        if (this.selectedTabId) {
          this.store.removeTab(this.selectedTabId);
        }
      },
    },
  ];

  @Output() save = new EventEmitter<void>();
  @Output() rotateCanvasLeft = new EventEmitter<void>();
  @Output() rotateCanvasRight = new EventEmitter<void>();
}
