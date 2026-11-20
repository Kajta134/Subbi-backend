import express, { type Express } from 'express';
import { errorHandler, notFound, requireAuth, type Deps } from './http.ts';
import { authRouter } from './routes/auth.ts';
import { meRouter } from './routes/me.ts';
import { subscriptionsRouter } from './routes/subscriptions.ts';

export function createApp(deps: Deps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/auth', authRouter(deps));
  app.use('/me', requireAuth(deps), meRouter(deps));
  app.use('/subscriptions', requireAuth(deps), subscriptionsRouter(deps));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
