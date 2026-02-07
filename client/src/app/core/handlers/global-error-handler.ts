import { ErrorHandler, Injectable, inject } from '@angular/core';

import { ErrorHandlerService } from '@core/services/error-handler.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly errorService = inject(ErrorHandlerService);

  public handleError(error: unknown): void {
    // Unikamy zapętlenia, jeśli błąd wystąpi podczas samej obsługi
    try {
      this.errorService.handleError(error);
    } catch (e) {
      console.error('Critical failure in GlobalErrorHandler:', e);
      console.error('Original error:', error);
    }
  }
}
