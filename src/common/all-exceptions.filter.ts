import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

/**
 * Sprowadza wszystkie błędy do `{ error, field? }` z polskim komunikatem
 * (zgodnie z tym, czego oczekuje aplikacja iOS).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const [status, body] = this.toBody(exception);
    res.status(status).json(body);
  }

  private toBody(exception: unknown): [number, { error: string; field?: string }] {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      // ApiError i błędy walidacji mają już właściwy format.
      if (typeof response === 'object' && response !== null && typeof (response as { error?: unknown }).error === 'string'
        && !('statusCode' in response)) {
        return [status, response as { error: string; field?: string }];
      }
      return [status, { error: defaultMessage(status) }];
    }

    this.logger.error(exception);
    return [HttpStatus.INTERNAL_SERVER_ERROR, { error: 'Błąd serwera.' }];
  }
}

function defaultMessage(status: number): string {
  switch (status) {
    case 400: return 'Nieprawidłowe dane.';
    case 401: return 'Wymagane logowanie.';
    case 403: return 'Brak dostępu.';
    case 404: return 'Nie znaleziono.';
    case 413: return 'Zbyt duże żądanie.';
    default: return status >= 500 ? 'Błąd serwera.' : 'Błąd żądania.';
  }
}
