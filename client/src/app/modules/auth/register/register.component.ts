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
  selector: 'app-register',
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
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterComponent implements OnInit {
  protected readonly store = inject(AuthStore);
  protected readonly success = this.store.loaded;

  public ngOnInit(): void {
    // Reset form state when entering registration page
    this.store.resetFormState();
  }

  public readonly companyName = signal<string>('');
  public readonly email = signal<string>('');
  public readonly phone = signal<string>('');
  public readonly password = signal<string>('');

  public onSubmit(): void {
    this.store.register({
      companyName: this.companyName(),
      email: this.email(),
      password: this.password(),
      phone: this.phone() || undefined,
    });
  }
}
