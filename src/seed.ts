import 'dotenv/config';
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { hashPassword } from './common/passwords';
import { loadConfig } from './config';
import type { PrismaClient } from './generated/prisma/client';
import { PrismaService } from './prisma/prisma.service';
import type { SubscriptionDto } from './subscriptions/subscription.dto';

/**
 * Konto demonstracyjne z historią subskrypcji: `npm run db:seed`.
 * Można uruchamiać wielokrotnie – odtwarza hasło i listę subskrypcji tylko tego konta.
 */
export const DEMO_USER = { email: 'example@email.com', password: 'password', name: 'Jan Przykładowy' };

type DemoSubscription = Pick<SubscriptionDto, 'name' | 'price' | 'period' | 'category' | 'symbol' | 'colorHex'> & {
  firstPayment: Date;
  deactivatedAt?: Date;
};

/** Historia liczona względem `now`, żeby wykres ostatnich 6 miesięcy zawsze był ciekawy. */
export function demoSubscriptions(now = new Date()): DemoSubscription[] {
  /** Dzień miesiąca (1–28) sprzed `months` miesięcy. */
  const ago = (months: number, day: number, hour = 9, minute = 0) =>
    new Date(now.getFullYear(), now.getMonth() - months, day, hour, minute);
  const inDays = (days: number, hour = 9) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour);

  const netflix = { symbol: 'brand:netflix', colorHex: 0xe50914, category: 'entertainment' } as const;
  const spotify = { symbol: 'brand:spotify', colorHex: 0x1db954, category: 'entertainment' } as const;
  const youtube = { symbol: 'brand:youtube', colorHex: 0xff0000, category: 'entertainment' } as const;
  const hbo = { symbol: 'brand:hbomax', colorHex: 0x6c2bd9, category: 'entertainment' } as const;
  const disney = { symbol: 'brand:disneyplus', colorHex: 0x113ccf, category: 'entertainment' } as const;
  const appleTv = { symbol: 'brand:appletv', colorHex: 0x2c2c2e, category: 'entertainment' } as const;
  const icloud = { symbol: 'brand:icloud', colorHex: 0x3b82f6, category: 'tools' } as const;
  const microsoft = { symbol: 'brand:microsoft365', colorHex: 0xd83b01, category: 'tools' } as const;
  const adobe = { symbol: 'brand:adobe', colorHex: 0xfa0f00, category: 'tools' } as const;
  const dropbox = { symbol: 'brand:dropbox', colorHex: 0x0061ff, category: 'tools' } as const;
  const chatgpt = { symbol: 'brand:chatgpt', colorHex: 0x10a37f, category: 'tools' } as const;
  const claude = { symbol: 'brand:claude', colorHex: 0xd97757, category: 'tools' } as const;
  const notion = { symbol: 'brand:notion', colorHex: 0x3a3a3c, category: 'tools' } as const;
  const gym = { symbol: 'dumbbell.fill', colorHex: 0xff9f0a, category: 'other' } as const;
  const press = { symbol: 'newspaper.fill', colorHex: 0x5e6ad2, category: 'other' } as const;

  return [
    // Stali bywalcy – opłacani od lat.
    { name: 'iCloud+', price: 4.99, period: 'month', ...icloud, firstPayment: ago(30, 2, 8, 15) },
    { name: 'Spotify', price: 23.99, period: 'month', ...spotify, firstPayment: ago(26, 6, 10) },
    { name: 'Netflix', price: 49, period: 'month', ...netflix, firstPayment: ago(20, 12, 18, 30) },
    { name: 'YouTube', price: 29.99, period: 'month', ...youtube, firstPayment: ago(9, 17, 12) },

    // Roczne – pojedyncze skoki na wykresie 2 i 4 miesiące temu.
    { name: 'Microsoft 365', price: 299.99, period: 'year', ...microsoft, firstPayment: ago(26, 14) },
    { name: 'Disney+', price: 289.9, period: 'year', ...disney, firstPayment: ago(16, 21, 20) },

    // Nowości: zamiana asystenta AI, prenumerata i okres próbny (pierwsza płatność dopiero za 5 dni).
    { name: 'Claude', price: 89.99, period: 'month', ...claude, firstPayment: ago(1, 9, 14, 45) },
    { name: 'Prenumerata prasy', price: 34.9, period: 'month', ...press, firstPayment: ago(3, 1, 6) },
    { name: 'Notion', price: 39.99, period: 'month', ...notion, firstPayment: inDays(5, 11) },

    // Porządki: Dropbox zastąpiony przez iCloud+.
    { name: 'Dropbox', price: 49.99, period: 'month', ...dropbox, firstPayment: ago(14, 8), deactivatedAt: ago(4, 20, 19) },
    // Adobe tylko na czas zlecenia.
    { name: 'Adobe', price: 119.99, period: 'month', ...adobe, firstPayment: ago(5, 3, 13), deactivatedAt: ago(3, 25, 16, 40) },
    // Jeden serial na HBO Max i koniec.
    { name: 'HBO Max', price: 29.99, period: 'month', ...hbo, firstPayment: ago(8, 19, 21), deactivatedAt: ago(3, 22, 22, 10) },
    // Zapał do siłowni minął po kilku miesiącach.
    { name: 'Siłownia', price: 139, period: 'month', ...gym, firstPayment: ago(7, 5, 7), deactivatedAt: ago(2, 16, 9, 30) },
    // ChatGPT ustąpił miejsca Claude.
    { name: 'ChatGPT', price: 99.99, period: 'month', ...chatgpt, firstPayment: ago(6, 10, 15), deactivatedAt: ago(1, 7, 17) },
    // Okres próbny anulowany przed pierwszą płatnością – nigdy nic nie kosztował.
    { name: 'Apple TV+', price: 34.99, period: 'month', ...appleTv, firstPayment: ago(4, 18), deactivatedAt: ago(4, 15, 23, 5) },
  ];
}

/** Tworzy konto demo (albo odtwarza jego stan). Zwraca liczbę zapisanych subskrypcji. */
export async function seedDemo(prisma: PrismaClient, now = new Date()): Promise<number> {
  const { email, name, password } = DEMO_USER;
  const passwordHash = await hashPassword(password);
  const list = demoSubscriptions(now);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { email },
      create: { email, name, passwordHash },
      update: { name, passwordHash },
    });
    await tx.subscription.deleteMany({ where: { userId: user.id } });
    await tx.subscription.createMany({
      // Identyfikatory wielkimi literami, jak z aplikacji iOS.
      data: list.map((s, position) => ({ ...s, userId: user.id, position, id: randomUUID().toUpperCase() })),
    });
  });
  return list.length;
}

async function main() {
  // Hasło konta demo jest publicznie znane.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seeder nie działa przy NODE_ENV=production (konto demo ma jawne hasło).');
  }
  const config = loadConfig();
  const prisma = new PrismaService(config);
  try {
    const count = await seedDemo(prisma);
    console.log(`[subbi] Konto demo: ${DEMO_USER.email} / ${DEMO_USER.password}, subskrypcje: ${count} (baza: ${config.databaseUrl})`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error('[subbi] Seeder:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
