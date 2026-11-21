import { HttpException, HttpStatus } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Format każdej odpowiedzi błędu – aplikacja iOS pokazuje `error` użytkownikowi. */
export class ErrorDto {
  @ApiProperty({ example: 'Nieprawidłowy e-mail lub hasło.' })
  error: string;

  @ApiPropertyOptional({ description: 'Pole, którego dotyczy błąd walidacji', example: 'password' })
  field?: string;
}

/** Wyjątek z komunikatem po polsku w formacie `{ error, field? }`. */
export class ApiError extends HttpException {
  constructor(status: HttpStatus, error: string, field?: string) {
    super(field ? { error, field } : { error }, status);
  }
}
