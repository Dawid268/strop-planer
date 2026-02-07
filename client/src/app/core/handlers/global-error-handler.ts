import { ErrorHandler, Injectable, inject } from '@angular/core';

import { ErrorHandlerService } from '@core/services/error-handler.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly errorService = inject(ErrorHandlerService);

  public handleError(error: unknown): void {
    // Unikamy zapętlenia, jeśli błąd wystąpi podczas samej obsługi
    try {
      this.errorService.handleError(error);
    } catch {
      // Last-resort: silent swallow to prevent infinite loop.
      // In production, Sentry SDK captures these independently.
    }
  }
}
