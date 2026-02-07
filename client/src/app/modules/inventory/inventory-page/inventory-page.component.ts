import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { DialogService } from 'primeng/dynamicdialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { SkeletonModule } from 'primeng/skeleton';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AddItemDialogComponent } from '@modules/inventory/add-item-dialog';
import { InventoryStore } from '@stores/inventory.store';
import type {
  InventoryItem,
  InventoryItemDimensions,
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
} from '@models/inventory.model';
import {
  InventoryFiltersComponent,
  InventoryLoadingSkeletonComponent,
} from './components';

@Component({
  selector: 'app-inventory-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TagModule,
    ProgressSpinnerModule,
    IconFieldModule,
    InputIconModule,
    SkeletonModule,
    ConfirmDialogModule,
    ToastModule,
    TranslocoModule,
    InventoryFiltersComponent,
    InventoryLoadingSkeletonComponent,
  ],
  providers: [DialogService, ConfirmationService, MessageService],
  templateUrl: './inventory-page.component.html',
  styleUrl: './inventory-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryPageComponent implements OnInit {
  public readonly store = inject(InventoryStore);
  private readonly dialogService = inject(DialogService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly translocoService = inject(TranslocoService);

  public searchQuery = '';
  public filterType = '';
  public filterManufacturer = '';
  public selectedItems: InventoryItem[] = [];

  public typeOptions = [
    { label: 'inventory.filters.allTypes', value: '' },
    { label: 'inventory.types.panel', value: 'panel' },
    { label: 'inventory.types.prop', value: 'prop' },
    { label: 'inventory.types.beam', value: 'beam' },
    { label: 'inventory.types.accessory', value: 'accessory' },
  ];

  public manufacturerOptions = [
    { label: 'inventory.filters.allManufacturers', value: '' },
    { label: 'PERI', value: 'PERI' },
    { label: 'DOKA', value: 'DOKA' },
    { label: 'ULMA', value: 'ULMA' },
  ];

  public ngOnInit(): void {
    this.store.loadItems();
  }

  public filteredItems(): InventoryItem[] {
    return this.store.items().filter((item) => {
      if (
        this.searchQuery &&
        !item.name.toLowerCase().includes(this.searchQuery.toLowerCase())
      )
        return false;
      if (this.filterType && item.type !== this.filterType) return false;
      if (
        this.filterManufacturer &&
        item.manufacturer !== this.filterManufacturer
      )
        return false;
      return true;
    });
  }

  // Intentionally empty - filtering handled by filteredItems()
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public applySearch(): void {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  public applyFilters(): void {}

  public formatDimensions(dim: InventoryItemDimensions | undefined): string {
    if (!dim) return '-';
    const parts = [];
    if (dim.length) parts.push(`L:${dim.length}`);
    if (dim.width) parts.push(`W:${dim.width}`);
    if (dim.height) parts.push(`H:${dim.height}`);
    return parts.join(' x ');
  }

  public getTypeLabel(type: string): string {
    return `inventory.types.${type}`;
  }

  public getTypeSeverity(
    type: string,
  ):
    | 'secondary'
    | 'success'
    | 'info'
    | 'warn'
    | 'danger'
    | 'contrast'
    | undefined {
    const severities: Record<
      string,
      'secondary' | 'success' | 'info' | 'warn' | 'danger' | 'contrast'
    > = {
      panel: 'success',
      prop: 'warn',
      beam: 'info',
      accessory: 'secondary',
    };
    return severities[type] || 'secondary';
  }

  public openAddDialog(): void {
    const ref = this.dialogService.open(AddItemDialogComponent, {
      header: this.translocoService.translate('inventory.addItem'),
      width: '500px',
      contentStyle: { overflow: 'auto' },
    });

    ref?.onClose.subscribe((result: CreateInventoryItemDto | undefined) => {
      if (result) {
        this.store.createItem(result);
        this.messageService.add({
          severity: 'success',
          summary: this.translocoService.translate('common.success'),
          detail: this.translocoService.translate(
            'inventory.notifications.itemAdded',
          ),
        });
      }
    });
  }

  public editItem(item: InventoryItem): void {
    const ref = this.dialogService.open(AddItemDialogComponent, {
      header: this.translocoService.translate('inventory.editItem'),
      width: '500px',
      contentStyle: { overflow: 'auto' },
      data: item,
    });

    ref?.onClose.subscribe((result: UpdateInventoryItemDto | undefined) => {
      if (result) {
        this.store.updateItem({ id: item.id, dto: result });
        this.messageService.add({
          severity: 'success',
          summary: this.translocoService.translate('common.success'),
          detail: this.translocoService.translate(
            'inventory.notifications.itemUpdated',
          ),
        });
      }
    });
  }

  public deleteItem(id: string): void {
    this.confirmationService.confirm({
      message: this.translocoService.translate('inventory.confirmDelete'),
      header: this.translocoService.translate('projects.confirmDeleteHeader'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translocoService.translate(
        'projects.confirmDeleteButton',
      ),
      rejectLabel: this.translocoService.translate('projects.cancel'),
      acceptButtonStyleClass: 'p-button-danger p-button-text',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => {
        this.store.deleteItem(id);
        this.messageService.add({
          severity: 'success',
          summary: this.translocoService.translate('common.success'),
          detail: this.translocoService.translate(
            'inventory.notifications.itemDeleted',
          ),
        });
      },
    });
  }

  public exportToCsv(): void {
    const itemsToExport =
      this.selectedItems.length > 0 ? this.selectedItems : this.filteredItems();

    if (itemsToExport.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: this.translocoService.translate('common.warning'),
        detail: this.translocoService.translate(
          'inventory.notifications.noItemsToExport',
        ),
      });
      return;
    }

    const headers = [
      this.translocoService.translate('inventory.table.name'),
      this.translocoService.translate('inventory.table.type'),
      this.translocoService.translate('inventory.table.manufacturer'),
      this.translocoService.translate('inventory.table.dimensions'),
      this.translocoService.translate('inventory.table.available'),
      this.translocoService.translate('inventory.table.reserved'),
    ];
    const rows = itemsToExport.map((item) => [
      item.name,
      this.translocoService.translate(this.getTypeLabel(item.type)),
      item.manufacturer,
      this.formatDimensions(item.dimensions),
      item.quantityAvailable,
      item.quantityReserved,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `magazyn_eksport_${new Date().toISOString().slice(0, 10)}.csv`,
      );
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}
