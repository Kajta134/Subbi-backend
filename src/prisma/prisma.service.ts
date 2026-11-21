import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { APP_CONFIG, type AppConfig } from '../config';
import { Prisma, PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super({ adapter: new PrismaBetterSqlite3({ url: config.databaseUrl }) });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

/** Naruszenie ograniczenia UNIQUE (np. zajęty e-mail). */
export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}
