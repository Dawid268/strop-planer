import {
  ApplicationConfig,
  provideZoneChangeDetection,
  isDevMode,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { provideTransloco } from '@jsverse/transloco';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';
import { ErrorHandler } from '@angular/core';
import { GlobalErrorHandler } from './core/handlers/global-error-handler';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ErrorHandlerService } from './core/services/error-handler.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    provideAnimationsAsync(),
    provideTransloco({
      config: {
        availableLangs: ['pl', 'en'],
        defaultLang: 'pl',
        fallbackLang: 'pl',
        reRenderOnLangChange: true,
        prodMode: !isDevMode(),
        missingHandler: {
          useFallbackTranslation: true,
          logMissingKey: true,
        },
      },
      loader: TranslocoHttpLoader,
    }),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: false, // Wymusza jasny motyw (wyłącza dark mode)
        },
      },
      ripple: true,
    }),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    MessageService,
    ConfirmationService,
    ErrorHandlerService,
  ],
};
