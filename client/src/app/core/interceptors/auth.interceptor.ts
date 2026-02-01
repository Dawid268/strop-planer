import { HttpInterceptorFn, HttpErrorResponse } from "@angular/common/http";
import { inject } from "@angular/core";
import { catchError, throwError, switchMap } from "rxjs";
import { AuthService } from "../../features/auth/services/auth.service";

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  let authReq = req;
  const skipUrls = ["/auth/login", "/auth/register"];
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
        !req.url.includes("/auth/login") &&
        !req.url.includes("/auth/refresh")
      ) {
        return authService.refreshToken().pipe(
          switchMap((response) => {
            const newAuthReq = req.clone({
              setHeaders: {
                Authorization: `Bearer ${response.data.access_token}`,
              },
            });
            return next(newAuthReq);
          }),
          catchError((refreshError) => {
            authService.logout();
            return throwError(() => refreshError);
          }),
        );
      }
      return throwError(() => error);
    }),
  );
};
