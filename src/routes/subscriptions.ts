import { Router } from 'express';
import { transaction, type Database } from '../db.ts';
import { currentUser, type Deps } from '../http.ts';
import { subscriptionListSchema, type SubscriptionDTO } from '../schemas.ts';

interface SubscriptionRow {
  id: string;
  name: string;
  price: number;
  period: SubscriptionDTO['period'];
  first_payment: string;
  category: SubscriptionDTO['category'];
  symbol: string;
  color_hex: number;
}

function listSubscriptions(db: Database, userId: string): SubscriptionDTO[] {
  const rows = db
    .prepare('SELECT * FROM subscriptions WHERE user_id = ? ORDER BY position')
    .all(userId) as unknown as SubscriptionRow[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    price: r.price,
    period: r.period,
    firstPayment: r.first_payment,
    category: r.category,
    symbol: r.symbol,
    colorHex: r.color_hex,
  }));
}

function replaceSubscriptions(db: Database, userId: string, list: SubscriptionDTO[]): void {
  transaction(db, () => {
    db.prepare('DELETE FROM subscriptions WHERE user_id = ?').run(userId);
    const insert = db.prepare(`
      INSERT INTO subscriptions
        (user_id, id, position, name, price, period, first_payment, category, symbol, color_hex)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    list.forEach((s, i) =>
      insert.run(userId, s.id, i, s.name, s.price, s.period, s.firstPayment, s.category, s.symbol, s.colorHex),
    );
  });
}

/**
 * Synchronizacja całej listy subskrypcji (aplikacja i tak przechowuje ją w całości).
 * Montowany za `requireAuth`.
 */
export function subscriptionsRouter({ db }: Deps): Router {
  const router = Router();

  // GET /subscriptions -> Subscription[]
  router.get('/', (_req, res) => {
    res.json(listSubscriptions(db, currentUser(res).id));
  });

  // PUT /subscriptions Subscription[] -> Subscription[]  (zastępuje całą listę)
  router.put('/', (req, res) => {
    const list = subscriptionListSchema.parse(req.body);
    const userId = currentUser(res).id;
    replaceSubscriptions(db, userId, list);
    res.json(listSubscriptions(db, userId));
  });

  return router;
}
