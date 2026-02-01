import { inject, Injectable } from '@angular/core';
import { MessageService } from 'primeng/api';

@Injectable({
  providedIn: 'root',
})
export class ErrorNotificationService {
  private readonly messageService = inject(MessageService);

  public showError(message: string, summary: string = 'Błąd'): void {
    this.messageService.add({
      severity: 'error',
      summary,
      detail: message,
      life: 5000,
    });
  }

  public showWarning(message: string, summary: string = 'Ostrzeżenie'): void {
    this.messageService.add({
      severity: 'warn',
      summary,
      detail: message,
      life: 5000,
    });
  }

  public showSuccess(message: string, summary: string = 'Sukces'): void {
    this.messageService.add({
      severity: 'success',
      summary,
      detail: message,
      life: 3000,
    });
  }

  public showInfo(message: string, summary: string = 'Informacja'): void {
    this.messageService.add({
      severity: 'info',
      summary,
      detail: message,
      life: 3000,
    });
  }
}
