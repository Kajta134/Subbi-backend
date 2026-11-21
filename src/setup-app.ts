import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express from 'express';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { validationPipe } from './common/validation';

/** Wspólna konfiguracja aplikacji – używana przez `main.ts` i testy e2e. */
export function setupApp(app: INestApplication): void {
  (app as NestExpressApplication).disable('x-powered-by');

  // Parser JSON podpięty ręcznie (aplikacja tworzona z `bodyParser: false`), żeby błędy składni
  // i zbyt duże żądania od razu dostawały odpowiedź w formacie `{ error }` (Nest zamienia je na
  // angielskie BadRequestException bez informacji o przyczynie).
  const json = express.json({ limit: '1mb' });
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    json(req, res, (err?: { type?: string }) => {
      if (!err) return next();
      const tooLarge = err.type === 'entity.too.large';
      res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? 'Zbyt duże żądanie.' : 'Nieprawidłowy format JSON.' });
    });
  });
  app.useGlobalPipes(validationPipe);
  app.useGlobalFilters(new AllExceptionsFilter());

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('subbi API')
      .setDescription(
        'Konta użytkowników i synchronizacja subskrypcji dla aplikacji iOS subbi.\n\n' +
          'Błędy mają postać `{ "error": "komunikat po polsku", "field"?: "pole" }`. ' +
          'Endpointy z kłódką wymagają nagłówka `Authorization: Bearer <token>` – token zwraca `/auth/login` lub `/auth/register` ' +
          '(przycisk **Authorize**).',
      )
      .setVersion('2.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
      .build(),
  );
  // UI: /docs, specyfikacja OpenAPI: /docs-json
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs-json' });
}
