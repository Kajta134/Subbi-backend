import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type Database = DatabaseSync;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name          TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    -- Zwiększany przy zmianie hasła: unieważnia wcześniej wydane tokeny.
    token_version INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    id            TEXT NOT NULL,
    position      INTEGER NOT NULL,
    name          TEXT NOT NULL,
    price         REAL NOT NULL,
    period        TEXT NOT NULL CHECK (period IN ('month', 'year')),
    first_payment TEXT NOT NULL,
    category      TEXT NOT NULL CHECK (category IN ('entertainment', 'tools', 'other')),
    symbol        TEXT NOT NULL,
    color_hex     INTEGER NOT NULL,
    PRIMARY KEY (user_id, id)
  );
`;

/** Otwiera (i w razie potrzeby tworzy) bazę SQLite. `:memory:` – baza w pamięci (testy). */
export function openDatabase(path: string): Database {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

/** Wykonuje `fn` w transakcji; przy wyjątku wycofuje zmiany. */
export function transaction<T>(db: Database, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** Czy błąd SQLite to naruszenie ograniczenia UNIQUE (SQLITE_CONSTRAINT_UNIQUE = 2067). */
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { errcode?: unknown }).errcode === 2067;
}
