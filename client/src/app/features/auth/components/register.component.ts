import { Component, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { CardModule } from "primeng/card";
import { InputTextModule } from "primeng/inputtext";
import { PasswordModule } from "primeng/password";
import { ButtonModule } from "primeng/button";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { MessageModule } from "primeng/message";
import { IconFieldModule } from "primeng/iconfield";
import { InputIconModule } from "primeng/inputicon";
import { TranslocoModule } from "@jsverse/transloco";
import { AuthService } from "../services/auth.service";

@Component({
  selector: "app-register",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CardModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    ProgressSpinnerModule,
    MessageModule,
    IconFieldModule,
    InputIconModule,
    TranslocoModule,
  ],
  template: `
    <div
      class="auth-container flex align-items-center justify-content-center min-h-screen p-4"
      *transloco="let t"
    >
      <p-card [header]="t('auth.registerSubtitle')" class="auth-card shadow-4">
        <ng-template pTemplate="header">
          <div class="flex align-items-center gap-3 p-4 pb-0">
            <i class="pi pi-th-large text-primary text-4xl"></i>
            <h1 class="text-2xl font-bold m-0 text-900">Szalunki Optimizer</h1>
          </div>
        </ng-template>

        <form
          (ngSubmit)="onSubmit()"
          #registerForm="ngForm"
          class="flex flex-column gap-3"
        >
          <div class="flex flex-column gap-1">
            <label for="companyName" class="font-medium text-900">{{
              t("auth.companyName")
            }}</label>
            <p-iconField iconPosition="right">
              <p-inputIcon styleClass="pi pi-briefcase"></p-inputIcon>
              <input
                id="companyName"
                pInputText
                name="companyName"
                [(ngModel)]="companyName"
                required
                minlength="2"
                class="w-full"
              />
            </p-iconField>
          </div>

          <div class="flex flex-column gap-1">
            <label for="email" class="font-medium text-900">{{
              t("auth.email")
            }}</label>
            <p-iconField iconPosition="right">
              <p-inputIcon styleClass="pi pi-envelope"></p-inputIcon>
              <input
                id="email"
                pInputText
                type="email"
                name="email"
                [(ngModel)]="email"
                required
                email
                class="w-full"
              />
            </p-iconField>
          </div>

          <div class="flex flex-column gap-1">
            <label for="phone" class="font-medium text-900">{{
              t("auth.phone")
            }}</label>
            <p-iconField iconPosition="right">
              <p-inputIcon styleClass="pi pi-phone"></p-inputIcon>
              <input
                id="phone"
                pInputText
                type="tel"
                name="phone"
                [(ngModel)]="phone"
                class="w-full"
              />
            </p-iconField>
          </div>

          <div class="flex flex-column gap-1">
            <label for="password" class="font-medium text-900">{{
              t("auth.password")
            }}</label>
            <p-password
              id="password"
              [(ngModel)]="password"
              name="password"
              [toggleMask]="true"
              required
              minLength="6"
              styleClass="w-full"
              inputStyleClass="w-full"
              [promptLabel]="t('auth.password')"
              [weakLabel]="'Słabe'"
              [mediumLabel]="'Średnie'"
              [strongLabel]="'Silne'"
            ></p-password>
            <small class="text-color-secondary">{{
              t("auth.passwordMinLength")
            }}</small>
          </div>

          @if (authService.error()) {
          <p-message
            severity="error"
            [text]="t('auth.registerError')"
            class="w-full mt-2"
          ></p-message>
          } @if (success()) {
          <p-message
            severity="success"
            [text]="t('auth.registerSuccess')"
            class="w-full mt-2"
          ></p-message>
          }

          <p-button
            type="submit"
            class="w-full mt-3"
            [disabled]="
              !registerForm.valid || authService.isLoading() || success()
            "
            [loading]="authService.isLoading()"
          >
            <ng-template pTemplate="content">
              @if (authService.isLoading()) {
              <p-progressSpinner
                styleClass="w-2rem h-2rem"
                strokeWidth="4"
              ></p-progressSpinner>
              } @else {
              <span class="w-full text-center font-bold">{{
                t("auth.register")
              }}</span>
              }
            </ng-template>
          </p-button>
        </form>

        <ng-template pTemplate="footer">
          <div class="flex justify-content-end mt-2">
            <a
              pButton
              routerLink="/login"
              class="p-button-text p-button-sm"
              [label]="t('auth.hasAccount') + ' ' + t('auth.login')"
            ></a>
          </div>
        </ng-template>
      </p-card>
    </div>
  `,
  styles: [
    `
      .auth-container {
        background: linear-gradient(
          135deg,
          var(--primary-color) 0%,
          var(--primary-800) 100%
        );
      }
      ::ng-deep .auth-card {
        width: 100%;
        max-width: 450px;
      }
      ::ng-deep .p-card .p-card-header {
        background: transparent;
      }
    `,
  ],
})
export class RegisterComponent {
  public readonly authService = inject(AuthService);

  public companyName = "";
  public email = "";
  public phone = "";
  public password = "";
  public readonly success = signal(false);

  public onSubmit(): void {
    this.authService
      .register({
        companyName: this.companyName,
        email: this.email,
        password: this.password,
        phone: this.phone || undefined,
      })
      .subscribe({
        next: () => this.success.set(true),
      });
  }
}
