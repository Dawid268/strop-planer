import { Injectable, inject, signal } from "@angular/core";
import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Router } from "@angular/router";
import { Observable, tap, catchError, throwError } from "rxjs";
import { environment } from "@env/environment";
import { AuthResponse, LoginDto, RegisterDto } from "../models/auth.models";
import { ApiResponse } from "@core/models/api-response.model";

@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly API_URL = `${environment.apiUrl}/auth`;
  public readonly isLoading = signal(false);
  public readonly error = signal<string | null>(null);

  public login(dto: LoginDto): Observable<ApiResponse<AuthResponse>> {
    this.isLoading.set(true);
    this.error.set(null);
    return this.http
      .post<ApiResponse<AuthResponse>>(`${this.API_URL}/login`, dto)
      .pipe(
        tap(() => this.isLoading.set(false)),
        catchError((err) => {
          this.isLoading.set(false);
          return this.handleError(err);
        }),
      );
  }

  public refreshToken(): Observable<ApiResponse<AuthResponse>> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return throwError(() => new Error("No refresh token"));

    this.isLoading.set(true);
    return this.http
      .post<ApiResponse<AuthResponse>>(
        `${this.API_URL}/refresh`,
        {},
        {
          headers: { Authorization: `Bearer ${refreshToken}` },
        },
      )
      .pipe(
        tap((response) => {
          this.isLoading.set(false);
          const data = response.data;
          this.saveTokens(data.access_token, data.refresh_token);
        }),
        catchError((err) => {
          this.isLoading.set(false);
          this.logout();
          return this.handleError(err);
        }),
      );
  }

  public register(dto: RegisterDto): Observable<unknown> {
    this.isLoading.set(true);
    this.error.set(null);
    return this.http.post(`${this.API_URL}/register`, dto).pipe(
      tap(() => this.isLoading.set(false)),
      catchError((err) => {
        this.isLoading.set(false);
        return this.handleError(err);
      }),
    );
  }

  public logout(): void {
    const token = this.getToken();
    if (token) {
      this.http.post(`${this.API_URL}/logout`, {}).subscribe();
    }
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    this.router.navigate(["/login"]);
  }

  public isAuthenticated(): boolean {
    return !!this.getToken();
  }

  public getToken(): string | null {
    return localStorage.getItem("access_token");
  }

  public getRefreshToken(): string | null {
    return localStorage.getItem("refresh_token");
  }

  public saveTokens(at: string, rt: string): void {
    localStorage.setItem("access_token", at);
    localStorage.setItem("refresh_token", rt);
  }

  private handleError(err: HttpErrorResponse): Observable<never> {
    const message = err.error?.message || "Wystąpił błąd. Spróbuj ponownie.";
    this.error.set(message);
    return throwError(() => new Error(message));
  }
}
