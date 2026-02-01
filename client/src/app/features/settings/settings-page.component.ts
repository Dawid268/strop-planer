import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { CardModule } from "primeng/card";
import { InputTextModule } from "primeng/inputtext";
import { ButtonModule } from "primeng/button";
import { ToggleSwitchModule } from "primeng/toggleswitch";
import { DividerModule } from "primeng/divider";
import { AppStore } from "../../core/store/app.store";

@Component({
  selector: "app-settings-page",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardModule,
    InputTextModule,
    ButtonModule,
    ToggleSwitchModule,
    DividerModule,
  ],
  templateUrl: "./settings-page.component.html",
  styleUrl: "./settings-page.component.scss",
})
export class SettingsPageComponent {
  private readonly appStore = inject(AppStore);

  public profile = {
    companyName: this.appStore.user()?.companyName || "",
    email: this.appStore.user()?.email || "",
    phone: "",
  };

  public preferences = {
    darkMode: false,
    snapToGrid: true,
    emailNotifications: true,
  };
}
