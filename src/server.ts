import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { openDatabase } from './db.ts';

const config = loadConfig();
const db = openDatabase(config.dbPath);
const app = createApp({ db, jwtSecret: config.jwtSecret });

const server = app.listen(config.port, config.host, () => {
  console.log(`[subbi] API działa na http://${config.host}:${config.port} (baza: ${config.dbPath})`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
