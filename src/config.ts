const DEV_SECRET = 'subbi-dev-secret-nie-uzywac-na-produkcji';

export interface AppConfig {
  port: number;
  host: string;
  databaseUrl: string;
  jwtSecret: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  let jwtSecret = env.JWT_SECRET ?? '';
  if (!jwtSecret) {
    if (env.NODE_ENV === 'production') {
      throw new Error('Brak zmiennej JWT_SECRET – jest wymagana w trybie produkcyjnym.');
    }
    console.warn('[subbi] JWT_SECRET nie ustawiony – używam sekretu deweloperskiego.');
    jwtSecret = DEV_SECRET;
  }

  return {
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? '0.0.0.0',
    databaseUrl: env.DATABASE_URL ?? 'file:./data/subbi.db',
    jwtSecret,
  };
}

/** Token wstrzykiwania konfiguracji (`@Inject(APP_CONFIG)`). */
export const APP_CONFIG = Symbol('APP_CONFIG');
