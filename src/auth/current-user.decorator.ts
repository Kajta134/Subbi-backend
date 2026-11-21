import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '../generated/prisma/client';

declare module 'express' {
  interface Request {
    /** Ustawiany przez `AuthGuard`. */
    user?: User;
  }
}

/** Zalogowany użytkownik (tylko w trasach chronionych `AuthGuard`). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => ctx.switchToHttp().getRequest<Request>().user!,
);
