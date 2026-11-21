import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiError } from '../common/api-error';
import { hashPassword, verifyPassword } from '../common/passwords';
import type { User } from '../generated/prisma/client';
import { UserDto } from '../users/user.dto';
import { EMAIL_TAKEN, UsersService } from '../users/users.service';
import type { ChangePasswordDto, LoginDto, RegisterDto, SessionDto } from './auth.dto';

export interface TokenPayload {
  sub: string;
  /** `users.token_version` w chwili wydania tokenu. */
  ver: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<SessionDto> {
    if (await this.users.findByEmail(dto.email)) throw new ApiError(HttpStatus.CONFLICT, EMAIL_TAKEN);
    const user = await this.users.create({
      email: dto.email,
      name: dto.name,
      passwordHash: await hashPassword(dto.password),
    });
    return this.session(user);
  }

  async login(dto: LoginDto): Promise<SessionDto> {
    const user = await this.users.findByEmail(dto.email);
    // Przy nieistniejącym koncie i tak liczymy skrót, żeby czas odpowiedzi nie zdradzał, które e-maile są zarejestrowane.
    const ok = user ? await verifyPassword(dto.password, user.passwordHash) : (await hashPassword(dto.password), false);
    if (!user || !ok) throw new ApiError(HttpStatus.UNAUTHORIZED, 'Nieprawidłowy e-mail lub hasło.');
    return this.session(user);
  }

  async changePassword(user: User, dto: ChangePasswordDto): Promise<SessionDto> {
    if (!(await verifyPassword(dto.currentPassword, user.passwordHash))) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Obecne hasło jest nieprawidłowe.', 'currentPassword');
    }
    const updated = await this.users.setPassword(user.id, await hashPassword(dto.newPassword));
    return this.session(updated);
  }

  private async session(user: User): Promise<SessionDto> {
    const payload: TokenPayload = { sub: user.id, ver: user.tokenVersion };
    return { token: await this.jwt.signAsync(payload), user: UserDto.from(user) };
  }
}
