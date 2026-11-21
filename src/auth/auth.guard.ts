import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { ApiError } from '../common/api-error';
import { UsersService } from '../users/users.service';
import type { TokenPayload } from './auth.service';

const EXPIRED = 'Sesja wygasła. Zaloguj się ponownie.';

/**
 * Wymaga nagłówka `Authorization: Bearer <token>`. Sprawdza podpis, ważność
 * i `tokenVersion` (zmiana hasła unieważnia stare tokeny). Użytkownik trafia do `request.user`.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new ApiError(HttpStatus.UNAUTHORIZED, 'Wymagane logowanie.');

    let payload: TokenPayload;
    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(token, { algorithms: ['HS256'] });
    } catch {
      throw new ApiError(HttpStatus.UNAUTHORIZED, EXPIRED);
    }

    const user = payload.sub ? await this.users.findById(payload.sub) : null;
    if (!user || user.tokenVersion !== payload.ver) throw new ApiError(HttpStatus.UNAUTHORIZED, EXPIRED);

    request.user = user;
    return true;
  }
}
