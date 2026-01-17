import type { Routes } from "@angular/router";
import { authGuard, guestGuard } from "./features/auth/guards/auth.guard";

export const routes: Routes = [
  // Auth routes (no shell)
  {
    path: "login",
    loadComponent: () =>
      import("./features/auth/components/login.component").then(
        (m) => m.LoginComponent
      ),
    canActivate: [guestGuard],
  },
  {
    path: "register",
    loadComponent: () =>
      import("./features/auth/components/register.component").then(
        (m) => m.RegisterComponent
      ),
    canActivate: [guestGuard],
  },

  // App Shell (authenticated)
  {
    path: "",
    loadComponent: () =>
      import("./shared/components/app-shell/app-shell.component").then(
        (m) => m.AppShellComponent
      ),
    canActivate: [authGuard],
    children: [
      {
        path: "",
        redirectTo: "dashboard",
        pathMatch: "full",
      },
      {
        path: "dashboard",
        loadComponent: () =>
          import("./features/dashboard/dashboard.component").then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: "projects",
        loadComponent: () =>
          import("./features/projects/projects-list.component").then(
            (m) => m.ProjectsListComponent
          ),
      },
      {
        path: "projects/:id",
        loadComponent: () =>
          import(
            "./features/projects/pages/project-overview/project-overview.component"
          ).then((m) => m.ProjectOverviewComponent),
      },
      {
        path: "projects/:id/editor",
        loadComponent: () =>
          import("./features/editor/editor-page.component").then(
            (m) => m.EditorPageComponent
          ),
      },
      {
        path: "inventory",
        loadComponent: () =>
          import("./features/inventory/inventory-page.component").then(
            (m) => m.InventoryPageComponent
          ),
      },
      {
        path: "dxf-viewer",
        loadComponent: () =>
          import(
            "./features/floor-plan/components/floor-plan-dxf-viewer/floor-plan-dxf-viewer.component"
          ).then((m) => m.FloorPlanDxfViewerComponent),
      },
      {
        path: "settings",
        loadComponent: () =>
          import("./features/settings/settings-page.component").then(
            (m) => m.SettingsPageComponent
          ),
      },
    ],
  },

  // Fallback
  {
    path: "**",
    redirectTo: "login",
  },
];
