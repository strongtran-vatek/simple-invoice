import request from 'supertest';
import { seedDefaultUser } from '../src/database/seed/seed-default-user.js';
import { validateSeedSettings } from '../src/database/seed/seed-settings.js';
import {
  createTestApp,
  TEST_BCRYPT_ROUNDS,
  type TestApp,
} from './support/test-app.js';

describe('Seed: default user (e2e)', () => {
  let testApp: TestApp;

  const settings = {
    SEED_USER_EMAIL: 'Seeded@Example.com',
    SEED_USER_PASSWORD: 'first-password',
    SEED_USER_FULLNAME: 'Seeded User',
  };
  const seed = (overrides = {}) =>
    seedDefaultUser(
      testApp.dataSource,
      { ...settings, ...overrides },
      TEST_BCRYPT_ROUNDS,
    );
  const login = (password: string) =>
    request(testApp.app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'seeded@example.com', password });

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('creates a user who can sign in, storing the email lower-cased', async () => {
    const user = await seed();

    expect(user.email).toBe('seeded@example.com');
    expect(user.passwordHash).not.toContain('first-password');
    await login('first-password').expect(200);
  });

  it('does not create a second user when run again', async () => {
    await seed();
    await seed();

    const [{ count }] = await testApp.dataSource.query<{ count: string }[]>(
      'SELECT count(*) FROM users',
    );
    expect(count).toBe('1');
  });

  it('resets the password and name to the configured values', async () => {
    const before = await seed();
    const after = await seed({
      SEED_USER_PASSWORD: 'second-password',
      SEED_USER_FULLNAME: 'Renamed',
    });

    expect(after.id).toBe(before.id);
    expect(after.fullname).toBe('Renamed');
    await login('second-password').expect(200);
    await login('first-password').expect(401);
  });
});

describe('validateSeedSettings', () => {
  it('accepts complete settings', () => {
    expect(
      validateSeedSettings({
        SEED_USER_EMAIL: 'reviewer@example.com',
        SEED_USER_PASSWORD: 'secret',
        SEED_USER_FULLNAME: 'Reviewer',
        UNRELATED: 'ignored',
      }),
    ).toEqual({
      SEED_USER_EMAIL: 'reviewer@example.com',
      SEED_USER_PASSWORD: 'secret',
      SEED_USER_FULLNAME: 'Reviewer',
    });
  });

  it('names every missing or malformed setting', () => {
    expect(() =>
      validateSeedSettings({ SEED_USER_EMAIL: 'not-an-email' }),
    ).toThrow(
      /SEED_USER_EMAIL[\s\S]*SEED_USER_PASSWORD[\s\S]*SEED_USER_FULLNAME/,
    );
  });
});
