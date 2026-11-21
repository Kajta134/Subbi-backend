import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { loadConfig } from './config';
import { setupApp } from './setup-app';

async function bootstrap() {
  const config = loadConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule.with(config), { bodyParser: false });
  setupApp(app);
  app.enableShutdownHooks();

  await app.listen(config.port, config.host);
  console.log(`[subbi] API działa na http://${config.host}:${config.port} (baza: ${config.databaseUrl})`);
  console.log(`[subbi] Dokumentacja Swagger: http://localhost:${config.port}/docs`);
}

void bootstrap();
