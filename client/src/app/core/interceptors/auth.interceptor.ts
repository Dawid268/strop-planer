import {
  HttpInterceptorFn,
  HttpErrorResponse,
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
} from '@angular/common/http';
import { inject } from '@angular/core';
import {
  catchError,
  throwError,
  switchMap,
  Observable,
  BehaviorSubject,
  filter,
  take,
} from 'rxjs';
import { AuthService } from '@api/auth.service';
import { AuthStore } from '@stores/auth.store';

// ============================================================================
// Refresh Token Lock (prevents concurrent refresh requests)
// ============================================================================

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

// ============================================================================
// Helpers
// ============================================================================

function addToken(
  req: HttpRequest<unknown>,
  token: string,
): HttpRequest<unknown> {
  return req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });
}

// ============================================================================
// Interceptor
// ============================================================================

const SKIP_URLS = ['/auth/login', '/auth/register', '/auth/refresh'];

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {
  const authStore = inject(AuthStore);
  const authService = inject(AuthService);
  const token = authStore.accessToken();

  const shouldSkip = SKIP_URLS.some((url) => req.url.includes(url));

  const authReq = token && !shouldSkip ? addToken(req, token) : req;

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !shouldSkip
      ) {
        // ---- Refresh flow with lock ----
        if (isRefreshing) {
          // Wait for the ongoing refresh to complete
          return refreshTokenSubject.pipe(
            filter((t): t is string => t !== null),
            take(1),
            switchMap((newToken) => next(addToken(req, newToken))),
          );
        }

        isRefreshing = true;
        refreshTokenSubject.next(null);

        const refreshTk = authStore.refreshToken();
        if (!refreshTk) {
          isRefreshing = false;
          authStore.logout();
          return throwError(() => error);
        }

        return authService.refreshToken(refreshTk).pipe(
          switchMap((response) => {
            isRefreshing = false;
            authStore.setTokens(
              response.access_token,
              response.refresh_token,
            );
            refreshTokenSubject.next(response.access_token);
            return next(addToken(req, response.access_token));
          }),
          catchError((refreshError: unknown) => {
            isRefreshing = false;
            refreshTokenSubject.next(null);
            authStore.logout();
            return throwError(() => refreshError);
          }),
        );
      }
      return throwError(() => error);
    }),
  );
};
