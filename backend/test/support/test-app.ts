import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { inject } from 'vitest';
import { configureApp } from '../../src/app.setup.js';

export interface TestApp {
  app: INestApplication<App>;
  dataSource: DataSource;
  databaseName: string;
}

/**
 * Boots the real application against a brand-new database on the shared test
 * server. The app applies its own migrations on start, so every e2e file also
 * exercises them.
 */
export async function createTestApp(): Promise<TestApp> {
  const server = inject('postgres');
  const databaseName = `test_${randomUUID().replaceAll('-', '')}`;

  const admin = new Client({ ...server, database: 'postgres' });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  await admin.end();

  Object.assign(process.env, {
    DB_HOST: server.host,
    DB_PORT: String(server.port),
    DB_USER: server.user,
    DB_PASSWORD: server.password,
    DB_NAME: databaseName,
    JWT_SECRET: 'test-secret-that-is-at-least-32-characters',
    JWT_EXPIRES_IN: '3600',
    APP_TIMEZONE: 'UTC',
    FRONTEND_ORIGIN: 'http://localhost:8080',
  });

  // Imported only now: module options read the environment at import time.
  const { AppModule } = await import('../../src/app.module.js');
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();

  return { app, dataSource: app.get(DataSource), databaseName };
}
