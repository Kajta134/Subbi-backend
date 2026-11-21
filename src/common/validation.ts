import { HttpStatus, ValidationError, ValidationPipe } from '@nestjs/common';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ApiError } from './api-error';

/** Pierwszy błąd (zagłębiając się w obiekty zagnieżdżone) jako `{ field, message }`. */
function firstError(errors: ValidationError[], prefix = ''): { field: string; message: string } | undefined {
  for (const e of errors) {
    const field = prefix ? `${prefix}.${e.property}` : e.property;
    const message = e.constraints ? Object.values(e.constraints)[0] : undefined;
    if (message) return { field, message };
    const nested = e.children?.length ? firstError(e.children, field) : undefined;
    if (nested) return nested;
  }
  return undefined;
}

function toApiError(errors: ValidationError[], prefix = ''): ApiError {
  const first = firstError(errors, prefix);
  return new ApiError(HttpStatus.BAD_REQUEST, first?.message ?? 'Nieprawidłowe dane.', first?.field);
}

/** Globalna walidacja DTO: obcina nieznane pola i zwraca błąd w formacie `{ error, field }`. */
export const validationPipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  stopAtFirstError: true,
  exceptionFactory: (errors) => toApiError(errors),
});

/**
 * Walidacja tablicy DTO w treści żądania (ValidationPipe nie obsługuje tablicy jako korzenia).
 * Ścieżka błędu ma postać `3.price`.
 */
export function validateArray<T extends object>(cls: ClassConstructor<T>, body: unknown, max: number): T[] {
  if (!Array.isArray(body)) {
    throw new ApiError(HttpStatus.BAD_REQUEST, 'Oczekiwano listy.');
  }
  if (body.length > max) {
    throw new ApiError(HttpStatus.BAD_REQUEST, `Lista może mieć najwyżej ${max} elementów.`);
  }
  return body.map((item, i) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Oczekiwano obiektu.', String(i));
    }
    const instance = plainToInstance(cls, item);
    const errors = validateSync(instance, { whitelist: true, stopAtFirstError: true });
    if (errors.length) throw toApiError(errors, String(i));
    return instance;
  });
}
