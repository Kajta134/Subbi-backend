import { Transform } from 'class-transformer';

/** Obcina spacje na brzegach napisu. */
export const Trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

/** Obcina spacje i zamienia na małe litery (adresy e-mail). */
export const NormalizeEmail = () =>
  Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));
