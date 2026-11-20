import { z } from 'zod';

// Komunikaty walidacji po polsku (trafiają bezpośrednio do aplikacji).
z.config(z.locales.pl());

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Podaj poprawny adres e-mail.' }).max(254));

const password = z
  .string({ error: 'Podaj hasło.' })
  .min(8, { error: 'Hasło musi mieć co najmniej 8 znaków.' })
  .max(200, { error: 'Hasło jest za długie.' });

const name = z
  .string({ error: 'Podaj imię i nazwisko.' })
  .trim()
  .min(1, { error: 'Podaj imię i nazwisko.' })
  .max(100, { error: 'Imię i nazwisko jest za długie.' });

export const registerSchema = z.object({ name, email, password });

export const loginSchema = z.object({
  email: z.string({ error: 'Podaj adres e-mail.' }).trim().toLowerCase(),
  password: z.string({ error: 'Podaj hasło.' }).min(1, { error: 'Podaj hasło.' }),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string({ error: 'Podaj obecne hasło.' }).min(1, { error: 'Podaj obecne hasło.' }),
  newPassword: password,
});

export const updateProfileSchema = z
  .object({ name: name.optional(), email: email.optional() })
  .refine((v) => v.name !== undefined || v.email !== undefined, { error: 'Brak danych do zmiany.' });

/** Kształt zgodny z `Subscription` (Codable) w aplikacji iOS; daty w ISO 8601. */
export const subscriptionSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(100),
  price: z.number().min(0).max(1_000_000),
  period: z.enum(['month', 'year']),
  firstPayment: z.iso.datetime({ offset: true }),
  category: z.enum(['entertainment', 'tools', 'other']),
  symbol: z.string().min(1).max(100),
  colorHex: z.int().min(0).max(0xffffffff),
});

export const subscriptionListSchema = z
  .array(subscriptionSchema)
  .max(500)
  .refine((list) => new Set(list.map((s) => s.id.toLowerCase())).size === list.length, {
    error: 'Lista zawiera powtórzone identyfikatory subskrypcji.',
  });

export type SubscriptionDTO = z.infer<typeof subscriptionSchema>;
