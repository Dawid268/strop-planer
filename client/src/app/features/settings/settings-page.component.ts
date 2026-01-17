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
  template: `
    <div class="settings-page p-4 max-w-screen-md mx-auto">
      <header class="page-header mb-5">
        <h1 class="text-3xl font-medium text-900 m-0">Ustawienia</h1>
        <p class="text-600 mt-2">Zarządzaj kontem i preferencjami</p>
      </header>

      <!-- Profile Card -->
      <p-card class="settings-card shadow-2 mb-4 border-none">
        <ng-template pTemplate="header">
          <div class="flex align-items-center gap-3 p-4 pb-0">
            <i class="pi pi-user text-primary text-2xl"></i>
            <span class="text-xl font-bold">Profil firmy</span>
          </div>
        </ng-template>

        <div class="flex flex-column gap-4 p-1">
          <div class="flex flex-column gap-2">
            <label for="companyName" class="font-medium text-900"
              >Nazwa firmy</label
            >
            <input
              id="companyName"
              pInputText
              [(ngModel)]="profile.companyName"
              class="w-full"
            />
          </div>

          <div class="flex flex-column gap-2">
            <label for="email" class="font-medium text-900">Email</label>
            <input
              id="email"
              pInputText
              [(ngModel)]="profile.email"
              disabled
              class="w-full bg-gray-50"
            />
          </div>

          <div class="flex flex-column gap-2">
            <label for="phone" class="font-medium text-900">Telefon</label>
            <input
              id="phone"
              pInputText
              [(ngModel)]="profile.phone"
              class="w-full"
            />
          </div>

          <div class="flex justify-content-end mt-2">
            <p-button
              label="Zapisz zmiany"
              icon="pi pi-check"
              severity="primary"
            ></p-button>
          </div>
        </div>
      </p-card>

      <!-- Preferences Card -->
      <p-card class="settings-card shadow-2 mb-4 border-none">
        <ng-template pTemplate="header">
          <div class="flex align-items-center gap-3 p-4 pb-0">
            <i class="pi pi-sliders-h text-primary text-2xl"></i>
            <span class="text-xl font-bold">Preferencje</span>
          </div>
        </ng-template>

        <div class="flex flex-column">
          <div
            class="preference-row flex align-items-center justify-content-between py-3 border-bottom-1 border-100"
          >
            <div class="flex flex-column gap-1">
              <span class="font-bold text-900">Tryb ciemny</span>
              <p class="m-0 text-sm text-600">Zmień kolorystykę interfejsu</p>
            </div>
            <p-toggleswitch [(ngModel)]="preferences.darkMode"></p-toggleswitch>
          </div>

          <div
            class="preference-row flex align-items-center justify-content-between py-3 border-bottom-1 border-100"
          >
            <div class="flex flex-column gap-1">
              <span class="font-bold text-900">Przyciąganie do siatki</span>
              <p class="m-0 text-sm text-600">Domyślnie włączone w edytorze</p>
            </div>
            <p-toggleswitch
              [(ngModel)]="preferences.snapToGrid"
            ></p-toggleswitch>
          </div>

          <div
            class="preference-row flex align-items-center justify-content-between py-3"
          >
            <div class="flex flex-column gap-1">
              <span class="font-bold text-900">Powiadomienia email</span>
              <p class="m-0 text-sm text-600">
                Otrzymuj powiadomienia o nowych funkcjach
              </p>
            </div>
            <p-toggleswitch
              [(ngModel)]="preferences.emailNotifications"
            ></p-toggleswitch>
          </div>
        </div>
      </p-card>

      <!-- Danger Zone -->
      <p-card
        class="settings-card shadow-2 border-red-100 border-1 surface-overlay"
      >
        <ng-template pTemplate="header">
          <div class="flex align-items-center gap-3 p-4 pb-0">
            <i class="pi pi-exclamation-triangle text-red-500 text-2xl"></i>
            <span class="text-xl font-bold text-red-500"
              >Strefa niebezpieczna</span
            >
          </div>
        </ng-template>

        <div class="flex flex-column gap-3 p-1">
          <p class="m-0 text-sm text-600">
            Usunięcie konta jest nieodwracalne. Wszystkie projekty i dane
            zostaną usunięte.
          </p>
          <div class="flex justify-content-end">
            <p-button
              label="Usuń konto"
              icon="pi pi-trash"
              severity="danger"
              [outlined]="true"
            ></p-button>
          </div>
        </div>
      </p-card>
    </div>
  `,
  styles: [
    `
      .settings-page {
      }
      ::ng-deep .p-card .p-card-body {
        padding: 1.5rem !important;
      }
    `,
  ],
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
