import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import type { Environment } from './config/env.validation.js';

/** Where Swagger UI is served. API endpoints themselves have no prefix (docs/adr/0005). */
export const SWAGGER_PATH = 'api/docs';

/**
 * Applies the cross-cutting HTTP behaviour: security headers, CORS, input
 * validation, the error shape and API docs. Shared by `main.ts` and the e2e
 * tests so both run the same application.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<Environment, true>>(ConfigService);

  app.use(helmet());
  app.enableCors({
    origin: config
      .get('FRONTEND_ORIGIN', { infer: true })
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      // Strip unknown properties, and reject requests that send them.
      whitelist: true,
      forbidNonWhitelisted: true,
      // Convert payloads to DTO instances so numeric query strings become numbers.
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('SimpleInvoice API')
      .setDescription('Authentication and invoice endpoints for SimpleInvoice.')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup(SWAGGER_PATH, app, document);
}
