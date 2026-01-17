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
  selector: "app-login",
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
      <p-card [header]="t('auth.loginSubtitle')" class="auth-card shadow-4">
        <ng-template pTemplate="header">
          <div class="flex align-items-center gap-3 p-4 pb-0">
            <i class="pi pi-th-large text-primary text-4xl"></i>
            <h1 class="text-2xl font-bold m-0 text-900">Szalunki Optimizer</h1>
          </div>
        </ng-template>

        <form
          (ngSubmit)="onSubmit()"
          #loginForm="ngForm"
          class="flex flex-column gap-4"
        >
          <div class="flex flex-column gap-2">
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
                [placeholder]="t('auth.email')"
              />
            </p-iconField>
          </div>

          <div class="flex flex-column gap-2">
            <label for="password" class="font-medium text-900">{{
              t("auth.password")
            }}</label>
            <p-password
              id="password"
              [(ngModel)]="password"
              name="password"
              [toggleMask]="true"
              [feedback]="false"
              required
              minLength="6"
              styleClass="w-full"
              inputStyleClass="w-full"
              [placeholder]="t('auth.password')"
            ></p-password>
          </div>

          @if (authService.error()) {
          <p-message
            severity="error"
            [text]="t('auth.loginError')"
            class="w-full"
          ></p-message>
          }

          <p-button
            type="submit"
            class="w-full mt-2"
            [disabled]="!loginForm.valid || authService.isLoading()"
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
                t("auth.login")
              }}</span>
              }
            </ng-template>
          </p-button>
        </form>

        <ng-template pTemplate="footer">
          <div class="flex justify-content-end mt-2">
            <a
              pButton
              routerLink="/register"
              class="p-button-text p-button-sm"
              [label]="t('auth.noAccount') + ' ' + t('auth.register')"
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
export class LoginComponent {
  public readonly authService = inject(AuthService);

  public email = "";
  public password = "";

  public onSubmit(): void {
    this.authService
      .login({ email: this.email, password: this.password })
      .subscribe();
  }
}
