import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { MessageModule } from 'primeng/message';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { TranslocoModule } from '@jsverse/transloco';

import { AuthStore } from '@stores/auth.store';

@Component({
  selector: 'app-login',
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
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit {
  protected readonly store = inject(AuthStore);

  public readonly email = signal<string>('');
  public readonly password = signal<string>('');

  public ngOnInit(): void {
    // Reset form state when entering login page
    this.store.resetFormState();
  }

  public onSubmit(): void {
    this.store.login({ email: this.email(), password: this.password() });
  }
}
