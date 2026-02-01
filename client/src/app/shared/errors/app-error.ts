export class AppError extends Error {
  constructor(
    public readonly code: string,
    public override readonly message: string,
    public readonly statusCode: number = 500,
    public readonly userMessage: string = 'Wystąpił nieoczekiwany błąd',
    public readonly context?: Record<string, any>,
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    public readonly fields: Record<string, string>,
  ) {
    super('VALIDATION_ERROR', message, 400, 'Nieprawidłowe dane wejściowe', {
      fields,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(
      'NOT_FOUND',
      `${resource} with id ${id} not found`,
      404,
      'Nie znaleziono zasobu',
    );
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super('UNAUTHORIZED', message, 401, 'Proszę się zalogować');
  }
}
