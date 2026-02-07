import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SkeletonModule } from 'primeng/skeleton';

@Component({
  selector: 'app-skeleton-loader',
  standalone: true,
  imports: [CommonModule, SkeletonModule],
  templateUrl: './skeleton-loader.component.html',
  styleUrl: './skeleton-loader.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkeletonLoaderComponent {
  @Input() type: 'text' | 'rect' | 'circle' = 'text';
  @Input() count = 1;
  @Input() width = '100%';
  @Input() height = '1rem';
  @Input() marginBottom = '0.5rem';
  @Input() borderRadius = '4px';

  get items(): number[] {
    return Array(this.count).fill(0);
  }
}
