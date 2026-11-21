import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { RejectNullCharactersPipe } from './common/pipes/reject-null-characters.pipe.js';
import type { Environment } from './config/env.validation.js';

/** Where Swagger UI is served. API endpoints themselves have no prefix (docs/adr/0005). */
export const SWAGGER_PATH = 'api/docs';

const API_DESCRIPTION = `
REST API of SimpleInvoice: sign in, list invoices, view one, create one.

**Trying it out.** Call \`POST /auth/login\` with the default account from the
README, copy \`accessToken\` from the response, press **Authorize** and paste it.
Every endpoint except login and the two health probes needs the token.

**Conventions**

- Dates are calendar dates written \`YYYY-MM-DD\`, with no time or timezone.
- Amounts are JSON numbers with at most two decimal places. The server
  calculates every total; a request never carries one.
- \`status\` is the effective status. \`Overdue\` is never stored: an invoice
  that is not \`Paid\` and whose due date has passed is reported as \`Overdue\`.
- Every error has the same shape: \`{ "statusCode", "message", "error" }\`.
  \`message\` is a list when several fields are invalid.
`.trim();

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
    // First, so text the database cannot hold is a 400 and never a 500.
    new RejectNullCharactersPipe(),
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
      .setDescription(API_DESCRIPTION)
      .setVersion('1.0')
      .addTag('auth', 'Signing in and identifying the signed-in user')
      .addTag('invoices', 'Listing, viewing and creating invoices')
      .addTag('health', 'Probes for Docker and other orchestrators')
      .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'The `accessToken` returned by `POST /auth/login`',
      })
      .build(),
  );
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    customSiteTitle: 'SimpleInvoice API',
    // Keep the token across page reloads, so it is pasted only once.
    swaggerOptions: { persistAuthorization: true },
  });
}
