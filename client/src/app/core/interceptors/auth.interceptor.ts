import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError, switchMap } from 'rxjs';
import { AuthService } from '@api/auth.service';
import { AuthStore } from '@stores/auth.store';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);
  const authService = inject(AuthService);
  const token = authStore.accessToken();

  let authReq = req;
  const skipUrls = ['/auth/login', '/auth/register'];
  const shouldSkip = skipUrls.some((url) => req.url.includes(url));

  if (token && !shouldSkip) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(authReq).pipe(
    catchError((error) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !req.url.includes('/auth/login') &&
        !req.url.includes('/auth/refresh')
      ) {
        const refreshToken = authStore.refreshToken();
        if (!refreshToken) {
          authStore.logout();
          return throwError(() => error);
        }
        return authService.refreshToken(refreshToken).pipe(
          switchMap((response) => {
            authStore.setTokens(response.access_token, response.refresh_token);
            const newAuthReq = req.clone({
              setHeaders: {
                Authorization: `Bearer ${response.access_token}`,
              },
            });
            return next(newAuthReq);
          }),
          catchError(() => {
            authStore.logout();
            return throwError(() => error);
          }),
        );
      }
      return throwError(() => error);
    }),
  );
};
