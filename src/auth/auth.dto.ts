import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { NormalizeEmail, Trim } from '../common/transforms';
import { UserDto } from '../users/user.dto';

export class RegisterDto {
  @ApiProperty({ example: 'Jan Kowalski', maxLength: 100 })
  @Trim()
  @IsString({ message: 'Podaj imię i nazwisko.' })
  @MinLength(1, { message: 'Podaj imię i nazwisko.' })
  @MaxLength(100, { message: 'Imię i nazwisko jest za długie.' })
  name: string;

  @ApiProperty({ example: 'jan.kowalski@example.com', description: 'Zapisywany małymi literami' })
  @NormalizeEmail()
  @IsEmail({}, { message: 'Podaj poprawny adres e-mail.' })
  @MaxLength(254, { message: 'Adres e-mail jest za długi.' })
  email: string;

  @ApiProperty({ example: 'tajnehaslo1', minLength: 8, maxLength: 200 })
  @IsString({ message: 'Podaj hasło.' })
  @MinLength(8, { message: 'Hasło musi mieć co najmniej 8 znaków.' })
  @MaxLength(200, { message: 'Hasło jest za długie.' })
  password: string;
}

export class LoginDto {
  @ApiProperty({ example: 'jan.kowalski@example.com' })
  @NormalizeEmail()
  @IsString({ message: 'Podaj adres e-mail.' })
  @MinLength(1, { message: 'Podaj adres e-mail.' })
  email: string;

  @ApiProperty({ example: 'tajnehaslo1' })
  @IsString({ message: 'Podaj hasło.' })
  @MinLength(1, { message: 'Podaj hasło.' })
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString({ message: 'Podaj obecne hasło.' })
  @MinLength(1, { message: 'Podaj obecne hasło.' })
  currentPassword: string;

  @ApiProperty({ minLength: 8, maxLength: 200 })
  @IsString({ message: 'Podaj nowe hasło.' })
  @MinLength(8, { message: 'Hasło musi mieć co najmniej 8 znaków.' })
  @MaxLength(200, { message: 'Hasło jest za długie.' })
  newPassword: string;
}

export class SessionDto {
  @ApiProperty({ description: 'JWT – wysyłaj jako `Authorization: Bearer <token>`. Ważny 30 dni.' })
  token: string;

  @ApiProperty({ type: UserDto })
  user: UserDto;
}
