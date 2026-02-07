import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { TranslocoModule } from '@jsverse/transloco';
import type { InventoryItem } from '@models/inventory.model';

@Component({
  selector: 'app-add-item-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    TranslocoModule,
  ],
  templateUrl: './add-item-dialog.component.html',
  styleUrls: ['./add-item-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddItemDialogComponent {
  public readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig);

  public readonly isEdit = !!this.config.data;
  public item = this.config.data
    ? {
        ...this.config.data,
        dimensions: { ...this.config.data.dimensions },
      }
    : {
        catalogCode: '',
        name: '',
        type: 'panel' as InventoryItem['type'],
        manufacturer: 'PERI',
        system: '',
        dimensions: { length: 0, width: 0, height: 0 },
        quantityAvailable: 1,
        weight: 0,
        dailyRentPrice: 0,
        condition: 'nowy' as InventoryItem['condition'],
        warehouseLocation: '',
      };

  public readonly typeOptions = [
    { label: 'inventory.types.panel', value: 'panel' },
    { label: 'inventory.types.prop', value: 'prop' },
    { label: 'inventory.types.beam', value: 'beam' },
    { label: 'inventory.types.head', value: 'head' },
    { label: 'inventory.types.tripod', value: 'tripod' },
    { label: 'inventory.types.drophead', value: 'drophead' },
    { label: 'inventory.types.accessory', value: 'accessory' },
  ];

  public readonly conditionOptions = [
    { label: 'inventory.conditions.new', value: 'nowy' },
    { label: 'inventory.conditions.good', value: 'dobry' },
    { label: 'inventory.conditions.used', value: 'używany' },
    { label: 'inventory.conditions.repair', value: 'do_naprawy' },
  ];

  public readonly manufacturerOptions = [
    { label: 'PERI', value: 'PERI' },
    { label: 'DOKA', value: 'DOKA' },
    { label: 'ULMA', value: 'ULMA' },
    { label: 'MEVA', value: 'MEVA' },
  ];

  public isValid(): boolean {
    return (
      !!this.item.catalogCode &&
      !!this.item.name &&
      !!this.item.type &&
      !!this.item.manufacturer &&
      !!this.item.condition &&
      this.item.quantityAvailable > 0 &&
      this.item.weight >= 0 &&
      this.item.dailyRentPrice >= 0
    );
  }

  public submit(): void {
    this.ref.close(this.item);
  }
}
