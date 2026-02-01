import { Component, inject } from "@angular/core";
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
  templateUrl: "./navbar.component.html",
  styleUrl: "./navbar.component.scss",
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
