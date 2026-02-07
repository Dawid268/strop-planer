import type { Routes } from '@angular/router';
import { authGuard, guestGuard } from '@guards/auth.guard';

export const routes: Routes = [
  // Auth routes (no shell)
  {
    path: 'login',
    loadComponent: () =>
      import('@modules/auth/login/login.component').then(
        (m) => m.LoginComponent,
      ),
    canActivate: [guestGuard],
  },
  {
    path: 'register',
    loadComponent: () =>
      import('@modules/auth/register/register.component').then(
        (m) => m.RegisterComponent,
      ),
    canActivate: [guestGuard],
  },

  // App Shell (authenticated)
  {
    path: '',
    loadComponent: () =>
      import('@shared/components/app-shell/app-shell.component').then(
        (m) => m.AppShellComponent,
      ),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('@modules/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('@modules/projects/projects-list/projects-list.component').then(
            (m) => m.ProjectsListComponent,
          ),
      },
      {
        path: 'projects/:id',
        loadComponent: () =>
          import('@modules/projects/project-overview/project-overview.component').then(
            (m) => m.ProjectOverviewComponent,
          ),
      },
      {
        path: 'projects/:id/editor',
        loadComponent: () =>
          import('@modules/editor/editor-page/editor-page.component').then(
            (m) => m.EditorPageComponent,
          ),
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('@modules/inventory/inventory-page/inventory-page.component').then(
            (m) => m.InventoryPageComponent,
          ),
      },
      {
        path: 'dxf-viewer',
        loadComponent: () =>
          import('@modules/floor-plan/floor-plan-dxf-viewer.component').then(
            (m) => m.FloorPlanDxfViewerComponent,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('@modules/settings/settings-page.component').then(
            (m) => m.SettingsPageComponent,
          ),
      },
    ],
  },

  // Fallback
  {
    path: '**',
    redirectTo: 'login',
  },
];
