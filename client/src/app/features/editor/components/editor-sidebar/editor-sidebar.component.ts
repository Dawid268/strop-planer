import {
  Component,
  inject,
  ChangeDetectionStrategy,
  signal,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccordionModule } from 'primeng/accordion';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { SliderModule } from 'primeng/slider';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { TranslocoModule } from '@jsverse/transloco';
import { InputTextModule } from 'primeng/inputtext';
import { MenuModule } from 'primeng/menu';
import { DialogModule } from 'primeng/dialog';
import { EditorStore } from '../../store/editor.store';
import { EditorLayer } from '@features/projects/models/project.model';

@Component({
  selector: 'app-editor-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AccordionModule,
    ToggleSwitchModule,
    ButtonModule,
    TooltipModule,
    TranslocoModule,
    SliderModule,
    DecimalPipe,
    InputTextModule,
    MenuModule,
    DialogModule,
  ],
  templateUrl: './editor-sidebar.component.html',
  styleUrls: ['./editor-sidebar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorSidebarComponent {
  public readonly store = inject(EditorStore);

  public showNewLayerDialog = signal(false);
  public showNewTabDialog = signal(false);
  public newLayerName = signal('');
  public newTabName = signal('');
  public editingLayerId = signal<string | null>(null);
  public editingTabId = signal<string | null>(null);
  public showMoveToLayerMenu = signal(false);

  public getLayerIcon(layer: EditorLayer): string {
    const icons: Record<string, string> = {
      ai_vectors: 'pi-sparkles',
      system: 'pi-cog',
      user: 'pi-user',
    };
    return icons[layer.type || 'user'] || 'pi-layers';
  }

  public getLayerTypeBadge(type: EditorLayer['type']): {
    label: string;
    class: string;
  } {
    const badges: Record<string, { label: string; class: string }> = {
      ai_vectors: { label: 'AI', class: 'bg-purple-100 text-purple-700' },
      system: { label: 'System', class: 'bg-gray-100 text-gray-700' },
      user: { label: 'Własna', class: 'bg-green-100 text-green-700' },
    };
    return badges[type || 'user'] || { label: 'Własna', class: 'bg-green-100 text-green-700' };
  }

  public openNewLayerDialog(): void {
    this.newLayerName.set('');
    this.editingLayerId.set(null);
    this.showNewLayerDialog.set(true);
  }

  public openNewTabDialog(): void {
    this.newTabName.set(`Strona ${this.store.tabs().length + 1}`);
    this.editingTabId.set(null);
    this.showNewTabDialog.set(true);
  }

  public saveAsLayer(): void {
    const name = this.newLayerName().trim();
    if (name) {
      this.store.saveSelectionAsLayer(name);
      this.showNewLayerDialog.set(false);
    }
  }

  public createEmptyLayer(): void {
    const name = this.newLayerName().trim();
    if (name) {
      this.store.createLayerInActiveTab(name, 'user');
      this.showNewLayerDialog.set(false);
    }
  }

  public createNewTab(): void {
    const name = this.newTabName().trim();
    if (name) {
      const tabId = this.store.addTab(name);
      this.store.setActiveTab(tabId);
      this.showNewTabDialog.set(false);
    }
  }

  public startEditingLayerName(layerId: string): void {
    const layer = this.store.activeLayers().find((l) => l.id === layerId);
    if (layer && layer.type !== 'system') {
      this.editingLayerId.set(layerId);
      this.newLayerName.set(layer.name);
    }
  }

  public startEditingTabName(tabId: string): void {
    const tab = this.store.tabs().find((t) => t.id === tabId);
    if (tab) {
      this.editingTabId.set(tabId);
      this.newTabName.set(tab.name);
    }
  }

  public saveLayerName(layerId: string): void {
    const name = this.newLayerName().trim();
    if (name) {
      this.store.renameLayer(layerId, name);
    }
    this.editingLayerId.set(null);
  }

  public saveTabName(tabId: string): void {
    const name = this.newTabName().trim();
    if (name) {
      this.store.renameTab(tabId, name);
    }
    this.editingTabId.set(null);
  }

  public getEditableLayers(): EditorLayer[] {
    return this.store.activeLayers().filter((l) => l.type !== 'system');
  }

  public isLayerEditable(layer: EditorLayer): boolean {
    return layer.type !== 'system' && layer.type !== 'ai_vectors';
  }

  public isLayerRemovable(layer: EditorLayer): boolean {
    return layer.type !== 'system';
  }

  public selectCatalogItem(
    code: string,
    name: string,
    width: number,
    length: number,
    type: 'panel' | 'prop' = 'panel',
  ): void {
    this.store.setActiveCatalogItem({
      code,
      name,
      width,
      length,
      manufacturer: 'PERI',
      system: 'MULTIFLEX',
      type,
    });
  }
}
