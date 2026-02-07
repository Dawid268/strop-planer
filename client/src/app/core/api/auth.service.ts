import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, throwError } from 'rxjs';

import { environment } from '@env/environment';

import {
  AuthResponse,
  AuthUser,
  LoginDto,
  RegisterDto,
} from '@models/auth.models';
import { ApiResponse } from '@models/api-response.model';

/**
 * Pure HTTP service for authentication API calls.
 * State (user, tokens) is held in AuthStore; sync with storage is via withStorageSync.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/auth`;

  /** Login user with credentials */
  public login(dto: LoginDto): Observable<AuthResponse> {
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.API_URL}/login`, dto)
      .pipe(map((res) => res.data));
  }

  /** Refresh access token using refresh token */
  public refreshToken(refreshToken: string): Observable<AuthResponse> {
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http
      .post<ApiResponse<AuthResponse>>(
        `${this.API_URL}/refresh`,
        {},
        { headers: { Authorization: `Bearer ${refreshToken}` } },
      )
      .pipe(map((res) => res.data));
  }

  /** Register new user */
  public register(dto: RegisterDto): Observable<void> {
    return this.http
      .post<ApiResponse<AuthUser>>(`${this.API_URL}/register`, dto)
      .pipe(map(() => void 0));
  }

  /**
   * Notify server about logout (fire-and-forget).
   * State clearing and navigation are handled by AuthStore.
   */
  public logoutApi(accessToken: string): void {
    this.http
      .post(
        `${this.API_URL}/logout`,
        {},
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      .subscribe();
  }
}
