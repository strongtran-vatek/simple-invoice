import request from 'supertest';
import { LOGIN_ATTEMPTS_PER_MINUTE } from '../src/auth/auth.module.js';
import { createTestApp, TEST_USER, type TestApp } from './support/test-app.js';

describe('Login rate limit (e2e)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({ throttling: true });
    await testApp.createUser();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('answers 429 once the attempts allowed in a minute are used up', async () => {
    const attempt = () =>
      request(testApp.app.getHttpServer())
        .post('/auth/login')
        .send({ email: TEST_USER.email, password: 'wrong-password' });

    for (let count = 0; count < LOGIN_ATTEMPTS_PER_MINUTE; count++) {
      await attempt().expect(401);
    }
    const blocked = await attempt().expect(429);

    expect(blocked.body).toEqual({
      statusCode: 429,
      message: 'Too many login attempts. Try again in a minute.',
      error: 'Too Many Requests',
    });
  });

  it('does not rate-limit other endpoints', async () => {
    await request(testApp.app.getHttpServer()).get('/auth/me').expect(401);
  });
});
