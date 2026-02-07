import { inject, Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AppError } from '@shared/errors/app-error';
import { ErrorNotificationService } from './error-notification.service';

@Injectable({
  providedIn: 'root',
})
export class ErrorHandlerService {
  private readonly notifier = inject(ErrorNotificationService);

  /**
   * Główny punkt wejścia do obsługi błędów.
   * Mapuje techniczne błędy na komunikaty zrozumiałe dla użytkownika.
   */
  public handleError(error: unknown): string {
    let message = 'Wystąpił nieoczekiwany błąd';

    if (error instanceof AppError) {
      message = error.userMessage;
      this.logToExternalService(error);
    } else if (error instanceof HttpErrorResponse) {
      message = this.getHttpErrorMessage(error);
    } else if (error instanceof Error) {
      message = error.message;
      this.logToExternalService(error);
    }

    // Wyświetl powiadomienie użytkownikowi
    this.notifier.showError(message);

    return message;
  }

  private getHttpErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'Brak połączenia z serwerem. Sprawdź swoje połączenie internetowe.';
    }

    // Jeśli serwer zwrócił AppError w formacie JSON (często w NestJS)
    if (error.error?.error?.message) {
      return error.error.error.message;
    }

    switch (error.status) {
      case 400:
        return 'Nieprawidłowe zapytanie (400).';
      case 401:
        return 'Sesja wygasła. Proszę zalogować się ponownie.';
      case 403:
        return 'Brak uprawnień do wykonania tej akcji.';
      case 404:
        return 'Nie znaleziono żądanego zasobu.';
      case 500:
        return 'Błąd serwera. Spróbuj ponownie później.';
      default:
        return `Wystąpił błąd komunikacji (Status: ${error.status})`;
    }
  }

  private logToExternalService(error: unknown): void {
    // TODO: Integrate with Sentry or other external logging service
    // For now, errors are handled by the notification service
    // When Sentry is integrated, replace this with:
    // Sentry.captureException(error);
    if (
      typeof window !== 'undefined' &&
      (window as Window & { __DEV__?: boolean }).__DEV__
    ) {
      // Only log in development mode
      // eslint-disable-next-line no-console
      console.error('[ErrorHandler]:', error);
    }
  }
}
