import { Router } from 'express';
import { HttpError } from '../errors.ts';
import { currentUser, requireAuth, signToken, type Deps } from '../http.ts';
import { hashPassword, verifyPassword } from '../passwords.ts';
import { changePasswordSchema, loginSchema, registerSchema } from '../schemas.ts';
import { createUser, findUserByEmail, setPassword, toPublicUser, type UserRow } from '../users.ts';

export function authRouter(deps: Deps): Router {
  const router = Router();
  const session = (user: UserRow) => ({ token: signToken(user, deps.jwtSecret), user: toPublicUser(user) });

  // POST /auth/register { name, email, password } -> 201 { token, user }
  router.post('/register', async (req, res) => {
    const body = registerSchema.parse(req.body);
    if (findUserByEmail(deps.db, body.email)) {
      throw new HttpError(409, 'Konto z tym adresem e-mail już istnieje.');
    }
    const user = createUser(deps.db, {
      email: body.email,
      name: body.name,
      passwordHash: await hashPassword(body.password),
    });
    res.status(201).json(session(user));
  });

  // POST /auth/login { email, password } -> 200 { token, user }
  router.post('/login', async (req, res) => {
    const body = loginSchema.parse(req.body);
    const user = findUserByEmail(deps.db, body.email);
    // Przy nieistniejącym koncie i tak liczymy skrót, żeby czas odpowiedzi nie zdradzał, które e-maile są zarejestrowane.
    const ok = user ? await verifyPassword(body.password, user.password_hash) : (await hashPassword(body.password), false);
    if (!user || !ok) throw new HttpError(401, 'Nieprawidłowy e-mail lub hasło.');
    res.json(session(user));
  });

  // POST /auth/change-password { currentPassword, newPassword } -> 200 { token, user }
  // Stare tokeny (np. na innych urządzeniach) przestają działać.
  router.post('/change-password', requireAuth(deps), async (req, res) => {
    const body = changePasswordSchema.parse(req.body);
    const user = currentUser(res);
    if (!(await verifyPassword(body.currentPassword, user.password_hash))) {
      throw new HttpError(400, 'Obecne hasło jest nieprawidłowe.');
    }
    const updated = setPassword(deps.db, user.id, await hashPassword(body.newPassword));
    res.json(session(updated));
  });

  return router;
}
