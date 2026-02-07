import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import { TranslocoModule } from '@jsverse/transloco';

@Component({
  selector: 'app-inventory-loading-skeleton',
  standalone: true,
  imports: [CommonModule, TableModule, SkeletonModule, TranslocoModule],
  templateUrl: './inventory-loading-skeleton.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryLoadingSkeletonComponent {
  public readonly rows = [1, 2, 3, 4, 5, 6, 7, 8];
}
