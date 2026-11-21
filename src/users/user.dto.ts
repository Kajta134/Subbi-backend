import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { NormalizeEmail, Trim } from '../common/transforms';
import type { User } from '../generated/prisma/client';

/** Dane użytkownika zwracane klientowi (bez hasła). */
export class UserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'jan.kowalski@example.com' })
  email: string;

  @ApiProperty({ example: 'Jan Kowalski' })
  name: string;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  static from(u: User): UserDto {
    return { id: u.id, email: u.email, name: u.name, createdAt: u.createdAt.toISOString() };
  }
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Jan Nowak', maxLength: 100 })
  @IsOptional()
  @Trim()
  @IsString({ message: 'Podaj imię i nazwisko.' })
  @MinLength(1, { message: 'Podaj imię i nazwisko.' })
  @MaxLength(100, { message: 'Imię i nazwisko jest za długie.' })
  name?: string;

  @ApiPropertyOptional({ example: 'jan.nowak@example.com' })
  @IsOptional()
  @NormalizeEmail()
  @IsEmail({}, { message: 'Podaj poprawny adres e-mail.' })
  @MaxLength(254, { message: 'Adres e-mail jest za długi.' })
  email?: string;
}
