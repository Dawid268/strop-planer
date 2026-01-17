import { Component, inject, OnInit } from "@angular/core";
import { CommonModule, DecimalPipe, DatePipe } from "@angular/common";
import { RouterLink, ActivatedRoute, Router } from "@angular/router";
import { TableModule } from "primeng/table";
import { CardModule } from "primeng/card";
import { ButtonModule } from "primeng/button";
import { TagModule } from "primeng/tag";
import { DialogService, DynamicDialogRef } from "primeng/dynamicdialog";
import { MenuModule } from "primeng/menu";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { SkeletonModule } from "primeng/skeleton";
import { MenuItem, ConfirmationService } from "primeng/api";
import { ConfirmDialogModule } from "primeng/confirmdialog";
import { NewProjectDialogComponent } from "./components/new-project-dialog.component";
import { ProjectsStore } from "./store/projects.store";
import type { Project } from "./models/project.model";

@Component({
  selector: "app-projects-list",
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
  ],
  providers: [DialogService, ConfirmationService],
  template: `
    <div class="projects-page p-4 max-w-screen-xl mx-auto">
      <header
        class="page-header flex flex-column md:flex-row md:justify-content-between md:align-items-start gap-4 mb-5"
      >
        <div>
          <h1 class="text-3xl font-medium text-900 m-0">Projekty</h1>
          <p class="text-600 mt-2">Zarządzaj projektami szalunków stropowych</p>
        </div>
        <button
          pButton
          label="Nowy projekt"
          icon="pi pi-plus"
          (click)="openNewProjectDialog()"
        ></button>
      </header>

      <p-card class="projects-card shadow-2 border-none">
        @if (store.loading()) {
          <p-table [value]="[1, 2, 3, 4, 5]" class="w-full">
            <ng-template pTemplate="header">
              <tr>
                <th style="width: 40%">Nazwa projektu</th>
                <th>Status</th>
                <th>Powierzchnia</th>
                <th>Aktualizacja</th>
                <th style="width: 4rem"></th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body">
              <tr>
                <td><p-skeleton width="70%"></p-skeleton></td>
                <td><p-skeleton width="50%"></p-skeleton></td>
                <td><p-skeleton width="40%"></p-skeleton></td>
                <td><p-skeleton width="60%"></p-skeleton></td>
                <td><p-skeleton shape="circle" size="2rem"></p-skeleton></td>
              </tr>
            </ng-template>
          </p-table>
        } @else if (store.projects().length === 0) {
          <div
            class="empty-state flex flex-column align-items-center justify-content-center p-8 text-center"
          >
            <i class="pi pi-folder-open text-7xl text-300 mb-4"></i>
            <h3 class="text-2xl font-bold text-900 m-0 mb-2">Brak projektów</h3>
            <p class="text-600 m-0 mb-4 px-4">
              Utwórz swój pierwszy projekt, aby rozpocząć optymalizację
              szalunków.
            </p>
            <button
              pButton
              label="Utwórz projekt"
              icon="pi pi-plus"
              (click)="openNewProjectDialog()"
            ></button>
          </div>
        } @else {
          <p-table
            [value]="store.projects()"
            [rows]="10"
            [paginator]="true"
            responsiveLayout="scroll"
            styleClass="p-datatable-sm"
          >
            <ng-template pTemplate="header">
              <tr>
                <th pSortableColumn="name" style="width: 40%">
                  Nazwa projektu <p-sortIcon field="name"></p-sortIcon>
                </th>
                <th pSortableColumn="status">
                  Status <p-sortIcon field="status"></p-sortIcon>
                </th>
                <th pSortableColumn="slabArea">
                  Powierzchnia <p-sortIcon field="slabArea"></p-sortIcon>
                </th>
                <th pSortableColumn="updatedAt">
                  Aktualizacja <p-sortIcon field="updatedAt"></p-sortIcon>
                </th>
                <th style="width: 4rem"></th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-project>
              <tr>
                <td>
                  <a
                    [routerLink]="['/projects', project.id]"
                    class="flex align-items-center gap-2 no-underline text-blue-600 font-medium hover:underline"
                  >
                    <i class="pi pi-file-pdf text-xl"></i>
                    {{ project.name }}
                  </a>
                </td>
                <td>
                  <p-tag
                    [severity]="getStatusSeverity(project.status)"
                    [value]="getStatusLabel(project.status)"
                  ></p-tag>
                </td>
                <td>{{ project.slabArea | number: "1.0-0" }} m²</td>
                <td>{{ project.updatedAt | date: "short" }}</td>
                <td>
                  <button
                    pButton
                    type="button"
                    icon="pi pi-ellipsis-v"
                    (click)="selectedProject = project; menu.toggle($event)"
                    class="p-button-text p-button-rounded p-button-secondary"
                  ></button>
                </td>
              </tr>
            </ng-template>
          </p-table>
          <p-menu
            #menu
            [model]="projectMenuItems"
            [popup]="true"
            appendTo="body"
          ></p-menu>
        }
      </p-card>
    </div>
    <p-confirmDialog
      header="Potwierdzenie"
      icon="pi pi-exclamation-triangle"
    ></p-confirmDialog>
  `,
  styles: [
    `
      .no-underline {
        text-decoration: none;
      }
      ::ng-deep .projects-card .p-card-content {
        padding: 0 !important;
      }
    `,
  ],
})
export class ProjectsListComponent implements OnInit {
  public readonly store = inject(ProjectsStore);
  private readonly dialogService = inject(DialogService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  public selectedProject: Project | null = null;
  public readonly projectMenuItems: MenuItem[] = [
    {
      label: "Edytuj",
      icon: "pi pi-pencil",
      command: () => {
        if (this.selectedProject) {
          this.router.navigate(["/projects", this.selectedProject.id]);
        }
      },
    },
    {
      separator: true,
    },
    {
      label: "Usuń",
      icon: "pi pi-trash",
      styleClass: "text-red-500",
      command: () => {
        if (this.selectedProject) {
          this.deleteProject(this.selectedProject.id);
        }
      },
    },
  ];

  public ngOnInit(): void {
    this.store.loadProjects();

    if (this.route.snapshot.queryParams["new"]) {
      setTimeout(() => this.openNewProjectDialog(), 100);
    }
  }

  public openNewProjectDialog(): void {
    const ref = this.dialogService.open(NewProjectDialogComponent, {
      header: "Nowy projekt",
      width: "50vw",
      contentStyle: { overflow: "auto" },
      baseZIndex: 10000,
      maximizable: true,
    });

    ref?.onClose.subscribe((result: Project | undefined) => {
      if (result) {
        this.store.addProject(result);
        this.router.navigate(["/projects", result.id, "editor"]);
      }
    });
  }

  public getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      draft: "Szkic",
      calculated: "Obliczono",
      optimized: "Zoptymalizowano",
      sent: "Wysłano",
      completed: "Zakończony",
    };
    return labels[status] || status;
  }

  public getStatusSeverity(
    status: string,
  ):
    | "secondary"
    | "success"
    | "info"
    | "warn"
    | "danger"
    | "contrast"
    | undefined {
    const severities: Record<
      string,
      "secondary" | "success" | "info" | "warn" | "danger" | "contrast"
    > = {
      draft: "secondary",
      calculated: "warn",
      optimized: "info",
      sent: "info",
      completed: "success",
    };
    return severities[status] || "secondary";
  }

  public deleteProject(id: string): void {
    this.confirmationService.confirm({
      message: "Czy na pewno chcesz usunąć ten projekt?",
      header: "Potwierdzenie usunięcia",
      icon: "pi pi-info-circle",
      acceptLabel: "Tak, usuń",
      rejectLabel: "Anuluj",
      acceptButtonStyleClass: "p-button-danger p-button-text",
      rejectButtonStyleClass: "p-button-text p-button-secondary",
      accept: () => {
        this.store.deleteProject(id);
      },
    });
  }
}
