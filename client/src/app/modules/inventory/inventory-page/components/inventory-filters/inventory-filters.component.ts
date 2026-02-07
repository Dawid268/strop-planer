import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  model,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TranslocoModule } from '@jsverse/transloco';

interface FilterOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-inventory-filters',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    InputTextModule,
    SelectModule,
    IconFieldModule,
    InputIconModule,
    TranslocoModule,
  ],
  templateUrl: './inventory-filters.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryFiltersComponent {
  public readonly typeOptions = input<FilterOption[]>([]);
  public readonly manufacturerOptions = input<FilterOption[]>([]);

  public searchQuery = model<string>('');
  public filterType = model<string>('');
  public filterManufacturer = model<string>('');

  public readonly searchChange = output<void>();
  public readonly filtersChange = output<void>();

  public onSearchChange(): void {
    this.searchChange.emit();
  }

  public onFilterChange(): void {
    this.filtersChange.emit();
  }
}
