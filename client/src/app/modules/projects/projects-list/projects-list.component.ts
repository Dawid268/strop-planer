import {
  Component,
  inject,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogService } from 'primeng/dynamicdialog';
import { MenuModule } from 'primeng/menu';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TranslocoModule } from '@jsverse/transloco';
import { SkeletonModule } from 'primeng/skeleton';
import { MenuItem, ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { NewProjectDialogComponent } from '@modules/projects/new-project-dialog/new-project-dialog.component';
import { ProjectsStore } from '@stores/projects.store';
import type { Project } from '@models/project.model';
import {
  ProjectsEmptyStateComponent,
  ProjectsLoadingSkeletonComponent,
} from './components';

@Component({
  selector: 'app-projects-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TableModule,
    CardModule,
    ButtonModule,
    TagModule,
    MenuModule,
    ProgressSpinnerModule,
    SkeletonModule,
    ConfirmDialogModule,
    DecimalPipe,
    DatePipe,
    TranslocoModule,
    ProjectsEmptyStateComponent,
    ProjectsLoadingSkeletonComponent,
  ],
  providers: [DialogService, ConfirmationService],
  templateUrl: './projects-list.component.html',
  styleUrl: './projects-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectsListComponent implements OnInit {
  public readonly store = inject(ProjectsStore);
  private readonly dialogService = inject(DialogService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  public selectedProject: Project | null = null;
  public readonly projectMenuItems: MenuItem[] = [
    {
      label: 'common.edit',
      icon: 'pi pi-pencil',
      command: (): void => {
        if (this.selectedProject) {
          this.router.navigate(['/projects', this.selectedProject.id]);
        }
      },
    },
    {
      separator: true,
    },
    {
      label: 'common.delete',
      icon: 'pi pi-trash',
      styleClass: 'text-red-500',
      command: (): void => {
        if (this.selectedProject) {
          this.deleteProject(this.selectedProject.id);
        }
      },
    },
  ];

  public ngOnInit(): void {
    this.store.loadProjects();

    if (this.route.snapshot.queryParams['new']) {
      this.openNewProjectDialog();
    }
  }

  public openNewProjectDialog(): void {
    const ref = this.dialogService.open(NewProjectDialogComponent, {
      header: 'Nowy projekt',
      width: '50vw',
      contentStyle: { overflow: 'auto' },
      baseZIndex: 10000,
      maximizable: true,
    });

    ref?.onClose
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result: Project | undefined) => {
        if (result) {
          this.store.addProject(result);
          this.router.navigate(['/projects', result.id, 'editor']);
        }
        this.cdr.markForCheck();
      });
  }

  public getStatusLabel(status: string): string {
    return `projects.status.${status}`;
  }

  public getStatusSeverity(
    status: string,
  ): 'secondary' | 'success' | 'info' | 'warn' | 'danger' | 'contrast' {
    const severities: Record<
      string,
      'secondary' | 'success' | 'info' | 'warn' | 'danger' | 'contrast'
    > = {
      draft: 'secondary',
      calculated: 'warn',
      optimized: 'info',
      sent: 'info',
      completed: 'success',
    };
    return severities[status] || 'secondary';
  }

  public deleteProject(id: string): void {
    this.confirmationService.confirm({
      message: 'Czy na pewno chcesz usunąć ten projekt?',
      header: 'Potwierdzenie usunięcia',
      icon: 'pi pi-info-circle',
      acceptLabel: 'Tak, usuń',
      rejectLabel: 'Anuluj',
      acceptButtonStyleClass: 'p-button-danger p-button-text',
      rejectButtonStyleClass: 'p-button-text p-button-secondary',
      accept: () => {
        this.store.deleteProject(id);
      },
    });
  }
}
