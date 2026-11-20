export interface Config {
  port: number;
  host: string;
  dbPath: string;
  jwtSecret: string;
}

const DEV_SECRET = 'subbi-dev-secret-nie-uzywac-na-produkcji';

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
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
    dbPath: env.DB_PATH ?? './data/subbi.db',
    jwtSecret,
  };
}
