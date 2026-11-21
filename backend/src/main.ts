import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp, SWAGGER_PATH } from './app.setup.js';
import type { Environment } from './config/env.validation.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  const config = app.get<ConfigService<Environment, true>>(ConfigService);
  const port = config.get('BACKEND_PORT', { infer: true });
  await app.listen(port);

  new Logger('Bootstrap').log(
    `Listening on port ${port}; API docs at /${SWAGGER_PATH}`,
  );
}

await bootstrap();
