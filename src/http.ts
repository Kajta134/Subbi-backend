import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { Database } from './db.ts';
import { HttpError } from './errors.ts';
import { findUserById, type UserRow } from './users.ts';

export interface Deps {
  db: Database;
  jwtSecret: string;
}

// ---------- Tokeny ----------

const TOKEN_TTL = '30d';

export function signToken(user: UserRow, secret: string): string {
  return jwt.sign({ ver: user.token_version }, secret, {
    subject: user.id,
    expiresIn: TOKEN_TTL,
    algorithm: 'HS256',
  });
}

/** Wymaga nagłówka `Authorization: Bearer <token>`; zalogowany użytkownik trafia do `res.locals.user`. */
export function requireAuth({ db, jwtSecret }: Deps): RequestHandler {
  return (req, res, next) => {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new HttpError(401, 'Wymagane logowanie.');

    let payload: jwt.JwtPayload;
    try {
      const decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
      if (typeof decoded === 'string') throw new Error('Nieoczekiwany format tokenu');
      payload = decoded;
    } catch {
      throw new HttpError(401, 'Sesja wygasła. Zaloguj się ponownie.');
    }

    const user = payload.sub ? findUserById(db, payload.sub) : undefined;
    if (!user || user.token_version !== payload.ver) {
      throw new HttpError(401, 'Sesja wygasła. Zaloguj się ponownie.');
    }
    res.locals.user = user;
    next();
  };
}

export function currentUser(res: Response): UserRow {
  return res.locals.user as UserRow;
}

// ---------- Obsługa błędów ----------

export const notFound: RequestHandler = () => {
  throw new HttpError(404, 'Nie znaleziono.');
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof z.ZodError) {
    const issue = err.issues[0];
    res.status(400).json({
      error: issue?.message ?? 'Nieprawidłowe dane.',
      field: issue?.path.join('.') || undefined,
    });
    return;
  }
  if ((err as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Nieprawidłowy format JSON.' });
    return;
  }
  if ((err as { type?: string }).type === 'entity.too.large') {
    res.status(413).json({ error: 'Zbyt duże żądanie.' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Błąd serwera.' });
};
