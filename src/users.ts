import { randomUUID } from 'node:crypto';
import { isUniqueViolation, type Database } from './db.ts';
import { HttpError } from './errors.ts';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  token_version: number;
  created_at: string;
}

/** Dane użytkownika zwracane klientowi (bez hasła). */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export function toPublicUser(u: UserRow): PublicUser {
  return { id: u.id, email: u.email, name: u.name, createdAt: u.created_at };
}

const EMAIL_TAKEN = 'Konto z tym adresem e-mail już istnieje.';

export function findUserById(db: Database, id: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export function findUserByEmail(db: Database, email: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
}

export function createUser(db: Database, data: { email: string; name: string; passwordHash: string }): UserRow {
  const id = randomUUID();
  try {
    db.prepare('INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)')
      .run(id, data.email, data.name, data.passwordHash);
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, EMAIL_TAKEN);
    throw err;
  }
  return findUserById(db, id)!;
}

export function updateUser(db: Database, id: string, data: { email?: string; name?: string }): UserRow {
  try {
    db.prepare('UPDATE users SET email = COALESCE(?, email), name = COALESCE(?, name) WHERE id = ?')
      .run(data.email ?? null, data.name ?? null, id);
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError(409, EMAIL_TAKEN);
    throw err;
  }
  return findUserById(db, id)!;
}

/** Ustawia nowe hasło i unieważnia wszystkie dotychczasowe tokeny. */
export function setPassword(db: Database, id: string, passwordHash: string): UserRow {
  db.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?')
    .run(passwordHash, id);
  return findUserById(db, id)!;
}

export function deleteUser(db: Database, id: string): void {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
}
