import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { inject } from 'vitest';
import { configureApp } from '../../src/app.setup.js';
import { BCRYPT_ROUNDS } from '../../src/auth/password.service.js';
import { Clock } from '../../src/common/clock.js';
import { seedDefaultUser } from '../../src/database/seed/seed-default-user.js';
import type { User } from '../../src/users/user.entity.js';

/** The lowest bcrypt cost, so hashing does not dominate test time. */
export const TEST_BCRYPT_ROUNDS = 4;

export const TEST_USER = {
  email: 'reviewer@example.com',
  password: 'correct-horse-battery',
  fullname: 'Test Reviewer',
};

export interface TestApp {
  app: INestApplication<App>;
  dataSource: DataSource;
  databaseName: string;
  /** Creates (or resets) the test user and returns it. */
  createUser(): Promise<User>;
  /** Creates the test user, signs in and returns an `Authorization` header value. */
  signIn(): Promise<string>;
}

export interface TestAppOptions {
  /** Keep the real login rate limit. Off by default so tests can log in freely. */
  throttling?: boolean;
  /** Pins "today" (`YYYY-MM-DD`) so Overdue derivation is deterministic. */
  today?: string;
}

/**
 * Boots the real application against a brand-new database on the shared test
 * server. The app applies its own migrations on start, so every e2e file also
 * exercises them.
 */
export async function createTestApp(
  options: TestAppOptions = {},
): Promise<TestApp> {
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
  const builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(BCRYPT_ROUNDS)
    .useValue(TEST_BCRYPT_ROUNDS);
  if (!options.throttling) {
    builder.overrideGuard(ThrottlerGuard).useValue({ canActivate: () => true });
  }
  if (options.today) {
    const today = options.today;
    builder.overrideProvider(Clock).useValue({ today: () => today });
  }
  const moduleRef = await builder.compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();

  const dataSource = app.get(DataSource);
  const createUser = () =>
    seedDefaultUser(
      dataSource,
      {
        SEED_USER_EMAIL: TEST_USER.email,
        SEED_USER_PASSWORD: TEST_USER.password,
        SEED_USER_FULLNAME: TEST_USER.fullname,
      },
      TEST_BCRYPT_ROUNDS,
    );

  return {
    app,
    dataSource,
    databaseName,
    createUser,
    async signIn() {
      await createUser();
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: TEST_USER.email, password: TEST_USER.password })
        .expect(200);
      return `Bearer ${response.body.accessToken}`;
    },
  };
}
