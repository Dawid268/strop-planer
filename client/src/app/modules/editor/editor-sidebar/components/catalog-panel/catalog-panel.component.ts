import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EditorStore } from '@stores/editor';

interface CatalogItem {
  code: string;
  name: string;
  width: number;
  length: number;
  type: 'panel' | 'prop';
  manufacturer: string;
  icon: string;
}

@Component({
  selector: 'app-catalog-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './catalog-panel.component.html',
  styleUrls: ['./catalog-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogPanelComponent {
  private readonly store = inject(EditorStore);

  public readonly catalogItems: CatalogItem[] = [
    {
      code: 'PANEL_120_60',
      name: 'Panel 120x60',
      width: 120,
      length: 60,
      type: 'panel',
      manufacturer: 'PERI MULTIFLEX',
      icon: 'pi-th-large',
    },
    {
      code: 'PANEL_90_60',
      name: 'Panel 90x60',
      width: 90,
      length: 60,
      type: 'panel',
      manufacturer: 'PERI MULTIFLEX',
      icon: 'pi-th-large',
    },
    {
      code: 'PROP_PEP_20_300',
      name: 'Stempel PEP 20-300',
      width: 20,
      length: 20,
      type: 'prop',
      manufacturer: 'PERI',
      icon: 'pi-stop',
    },
  ];

  public selectItem(item: CatalogItem): void {
    this.store.setActiveCatalogItem({
      code: item.code,
      name: item.name,
      width: item.width,
      length: item.length,
      manufacturer: item.manufacturer.split(' ')[0],
      system: item.manufacturer.split(' ')[1] || '',
      type: item.type,
    });
  }
}
