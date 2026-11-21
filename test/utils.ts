import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup-app';

export interface TestApp {
  app: INestApplication;
  close: () => Promise<void>;
}

/** Aplikacja na świeżej bazie SQLite w katalogu tymczasowym (z zastosowanymi migracjami). */
export async function createTestApp(): Promise<TestApp> {
  const dir = mkdtempSync(join(tmpdir(), 'subbi-test-'));
  const databaseUrl = `file:${join(dir, 'test.db')}`;
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.with({ port: 0, host: '127.0.0.1', databaseUrl, jwtSecret: 'test-secret' })],
  }).compile();
  const app = moduleRef.createNestApplication({ bodyParser: false });
  setupApp(app);
  await app.init();

  return {
    app,
    close: async () => {
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
