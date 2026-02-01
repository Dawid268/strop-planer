import { HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { catchError, retry, throwError, timer } from "rxjs";
import { ErrorHandlerService } from "../services/error-handler.service";

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const errorHandler = inject(ErrorHandlerService);

  return next(req).pipe(
    // Ponawiamy próbę tylko dla błędów sieciowych lub 5xx
    retry({
      count: 2,
      delay: (error, retryCount) => {
        if (error instanceof HttpErrorResponse && error.status >= 500) {
          return timer(retryCount * 1000);
        }
        throw error;
      },
    }),
    catchError((error: HttpErrorResponse) => {
      // Obsługujemy błąd centralnie, ale ignorujemy 401 bo zajmuje się nim authInterceptor
      if (error.status !== 401) {
        errorHandler.handleError(error);
      }
      return throwError(() => error);
    }),
  );
};
