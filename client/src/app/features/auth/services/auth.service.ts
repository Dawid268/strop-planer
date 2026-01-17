import { Injectable, inject, signal } from "@angular/core";
import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Router } from "@angular/router";
import { Observable, tap, catchError, throwError } from "rxjs";
import { AppStore } from "../../../core/store/app.store";
import { environment } from "../../../../environments/environment";

export interface LoginDto {
  readonly email: string;
  readonly password: string;
}

export interface RegisterDto {
  readonly companyName: string;
  readonly email: string;
  readonly password: string;
  readonly phone?: string;
}

export interface AuthResponse {
  readonly access_token: string;
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly companyName: string;
    readonly role: string;
  };
}

@Injectable({ providedIn: "root" })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly appStore = inject(AppStore);

  private readonly API_URL = `${environment.apiUrl}/auth`;

  public readonly isLoading = signal(false);
  public readonly error = signal<string | null>(null);

  public login(dto: LoginDto): Observable<AuthResponse> {
    this.isLoading.set(true);
    this.error.set(null);

    return this.http.post<AuthResponse>(`${this.API_URL}/login`, dto).pipe(
      tap((response) => {
        this.saveToken(response.access_token);
        this.appStore.setUser(response.user);
        this.isLoading.set(false);
        this.router.navigate(["/dashboard"]);
      }),
      catchError((err) => this.handleError(err)),
    );
  }

  public register(dto: RegisterDto): Observable<any> {
    this.isLoading.set(true);
    this.error.set(null);

    return this.http.post(`${this.API_URL}/register`, dto).pipe(
      tap(() => {
        this.isLoading.set(false);
        this.router.navigate(["/login"]);
      }),
      catchError((err) => this.handleError(err)),
    );
  }

  public logout(): void {
    this.appStore.logout();
    this.router.navigate(["/login"]);
  }

  public isAuthenticated(): boolean {
    return !!this.getToken();
  }

  public getToken(): string | null {
    return localStorage.getItem("access_token");
  }

  private saveToken(token: string): void {
    localStorage.setItem("access_token", token);
  }

  private handleError(err: HttpErrorResponse): Observable<never> {
    this.isLoading.set(false);
    const message = err.error?.message || "Wystąpił błąd. Spróbuj ponownie.";
    this.error.set(message);
    return throwError(() => new Error(message));
  }
}
