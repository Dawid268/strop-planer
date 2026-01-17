import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { NavbarComponent } from "../navbar/navbar.component";

@Component({
  selector: "app-shell",
  standalone: true,
  imports: [RouterOutlet, NavbarComponent],
  template: `
    <app-navbar />
    <main class="main-content">
      <router-outlet />
    </main>
  `,
  styles: [
    `
      .main-content {
        margin-top: 64px;
        min-height: calc(100vh - 64px);
        background: #f5f5f5;
      }
    `,
  ],
})
export class AppShellComponent {}
