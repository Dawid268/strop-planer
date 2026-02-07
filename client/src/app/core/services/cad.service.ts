import { Injectable, inject, signal } from '@angular/core';
import { ProjectsApiService } from '@core/api/projects-api.service';
import { ErrorHandlerService } from '@core/services/error-handler.service';
import { finalize, tap } from 'rxjs/operators';
import type { CadData } from '@models/cad.models';

// Re-export for backward compatibility
export type { CadData };

@Injectable({ providedIn: 'root' })
export class CadService {
  private readonly api = inject(ProjectsApiService);
  private readonly errorHandler = inject(ErrorHandlerService);

  private readonly _cadData = signal<CadData | null>(null);
  private readonly _loading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  public readonly cadData = this._cadData.asReadonly();
  public readonly isLoading = this._loading.asReadonly();
  public readonly error = this._error.asReadonly();

  public loadCadData(projectId: string): void {
    this._loading.set(true);
    this._error.set(null);

    this.api
      .getCadData(projectId)
      .pipe(
        tap({
          next: (data) => {
            this._cadData.set(data);
          },
          error: (err: Error) => {
            this.errorHandler.handleError(err);
            this._error.set(err.message || 'Błąd podczas ładowania danych CAD');
          },
        }),
        finalize(() => this._loading.set(false)),
      )
      .subscribe();
  }

  public clear(): void {
    this._cadData.set(null);
    this._error.set(null);
  }
}
