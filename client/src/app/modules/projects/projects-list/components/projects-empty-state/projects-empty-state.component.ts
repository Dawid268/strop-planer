import { Component, ChangeDetectionStrategy, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TranslocoModule } from '@jsverse/transloco';

@Component({
  selector: 'app-projects-empty-state',
  standalone: true,
  imports: [CommonModule, ButtonModule, TranslocoModule],
  templateUrl: './projects-empty-state.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsEmptyStateComponent {
  public readonly createProject = output<void>();
}
