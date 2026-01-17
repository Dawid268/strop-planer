import { Component, inject, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink, RouterLinkActive } from "@angular/router";
import { ToolbarModule } from "primeng/toolbar";
import { ButtonModule } from "primeng/button";
import { MenuModule } from "primeng/menu";
import { DividerModule } from "primeng/divider";
import { MenuItem } from "primeng/api";
import { AppStore } from "../../../core/store/app.store";
import { AuthService } from "../../../features/auth/services/auth.service";

@Component({
  selector: "app-navbar",
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    ToolbarModule,
    ButtonModule,
    MenuModule,
    DividerModule,
  ],
  template: `
    <p-toolbar class="navbar border-none py-2 px-4 shadow-2">
      <div class="p-toolbar-group-start">
        <div
          class="nav-brand flex align-items-center gap-2 cursor-pointer"
          routerLink="/dashboard"
        >
          <i class="pi pi-th-large text-2xl"></i>
          <span class="brand-text font-bold text-xl">Szalunki</span>
        </div>

        <nav class="nav-links flex gap-2 ml-4">
          <a
            pButton
            routerLink="/dashboard"
            routerLinkActive="active"
            label="Dashboard"
            icon="pi pi-home"
            class="p-button-text p-button-sm text-white"
          ></a>
          <a
            pButton
            routerLink="/projects"
            routerLinkActive="active"
            label="Projekty"
            icon="pi pi-folder"
            class="p-button-text p-button-sm text-white"
          ></a>
          <a
            pButton
            routerLink="/inventory"
            routerLinkActive="active"
            label="Magazyn"
            icon="pi pi-box"
            class="p-button-text p-button-sm text-white"
          ></a>
        </nav>
      </div>

      <div class="p-toolbar-group-end">
        <button
          pButton
          type="button"
          icon="pi pi-user"
          (click)="userMenu.toggle($event)"
          class="p-button-rounded p-button-text text-white"
        ></button>
        <p-menu #userMenu [model]="menuItems" [popup]="true">
          <ng-template pTemplate="start">
            <div class="user-info p-3 flex flex-column">
              <span class="font-bold">{{
                appStore.user()?.companyName || "Użytkownik"
              }}</span>
              <small class="text-color-secondary">{{
                appStore.user()?.email
              }}</small>
            </div>
          </ng-template>
        </p-menu>
      </div>
    </p-toolbar>
  `,
  styles: [
    `
      .navbar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 1000;
        background: linear-gradient(135deg, #3f51b5 0%, #303f9f 100%);
        border-radius: 0;
      }

      .nav-links ::ng-deep .active {
        background: rgba(255, 255, 255, 0.15) !important;
      }

      .user-info {
        border-bottom: 1px solid var(--surface-border);
      }
    `,
  ],
})
export class NavbarComponent {
  public readonly appStore = inject(AppStore);
  private readonly authService = inject(AuthService);

  public readonly menuItems: MenuItem[] = [
    {
      label: "Ustawienia",
      icon: "pi pi-cog",
      routerLink: "/settings",
    },
    {
      separator: true,
    },
    {
      label: "Wyloguj",
      icon: "pi pi-sign-out",
      command: () => this.logout(),
    },
  ];

  public logout(): void {
    this.authService.logout();
  }
}
