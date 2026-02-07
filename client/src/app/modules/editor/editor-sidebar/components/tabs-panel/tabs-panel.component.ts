import {
  Component,
  inject,
  ChangeDetectionStrategy,
  signal,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { InputTextModule } from 'primeng/inputtext';
import { EditorStore } from '@stores/editor';
import { ElementRef, viewChild } from '@angular/core';

@Component({
  selector: 'app-tabs-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    TooltipModule,
    InputTextModule,
  ],
  templateUrl: './tabs-panel.component.html',
  styleUrls: ['./tabs-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabsPanelComponent {
  public readonly store = inject(EditorStore);

  public editingTabId = signal<string | null>(null);
  public editingTabName = signal('');

  public readonly openNewTabDialog = output<void>();

  private readonly editingInput = viewChild<ElementRef<HTMLInputElement>>('renameInput');

  public startEditingTabName(tabId: string): void {
    const tab = this.store.tabs().find((t) => t.id === tabId);
    if (tab) {
      this.editingTabId.set(tabId);
      this.editingTabName.set(tab.name);
      
      // Auto-focus after render
      setTimeout(() => {
        this.editingInput()?.nativeElement.focus();
        this.editingInput()?.nativeElement.select();
      }, 0);
    }
  }

  public saveTabName(tabId: string): void {
    if (this.editingTabId() !== tabId) return; // Prevent double call
    
    const name = this.editingTabName().trim();
    if (name) {
      this.store.renameTab(tabId, name);
    }
    this.editingTabId.set(null);
  }

  public onNewTabClick(): void {
    this.openNewTabDialog.emit();
  }
}
