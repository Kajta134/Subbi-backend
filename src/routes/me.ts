import { Router } from 'express';
import { currentUser, type Deps } from '../http.ts';
import { updateProfileSchema } from '../schemas.ts';
import { deleteUser, toPublicUser, updateUser } from '../users.ts';

/** Profil zalogowanego użytkownika. Montowany za `requireAuth`. */
export function meRouter({ db }: Deps): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(toPublicUser(currentUser(res)));
  });

  // PATCH /me { name?, email? }
  router.patch('/', (req, res) => {
    const body = updateProfileSchema.parse(req.body);
    res.json(toPublicUser(updateUser(db, currentUser(res).id, body)));
  });

  // DELETE /me – usuwa konto razem z subskrypcjami.
  router.delete('/', (_req, res) => {
    deleteUser(db, currentUser(res).id);
    res.status(204).end();
  });

  return router;
}
