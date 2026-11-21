import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp, TEST_USER, type TestApp } from './support/test-app.js';

describe('Authentication (e2e)', () => {
  let testApp: TestApp;
  let userId: string;

  const http = () => request(testApp.app.getHttpServer());
  const login = (body: object) => http().post('/auth/login').send(body);

  async function accessToken(): Promise<string> {
    const response = await login({
      email: TEST_USER.email,
      password: TEST_USER.password,
    }).expect(200);
    return response.body.accessToken as string;
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    userId = (await testApp.createUser()).id;
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  describe('POST /auth/login', () => {
    it('returns 200 and a bearer token for valid credentials', async () => {
      const response = await login({
        email: TEST_USER.email,
        password: TEST_USER.password,
      }).expect(200);

      expect(response.body).toEqual({
        accessToken: expect.stringMatching(/^[\w-]+\.[\w-]+\.[\w-]+$/),
        tokenType: 'Bearer',
        expiresIn: 3600,
      });
    });

    it('ignores letter case and surrounding spaces in the email', async () => {
      await login({
        email: '  Reviewer@Example.COM ',
        password: TEST_USER.password,
      }).expect(200);
    });

    it('rejects a wrong password with 401', async () => {
      const response = await login({
        email: TEST_USER.email,
        password: 'wrong-password',
      }).expect(401);

      expect(response.body).toEqual({
        statusCode: 401,
        message: 'Invalid email or password',
        error: 'Unauthorized',
      });
    });

    it('answers an unknown email exactly like a wrong password', async () => {
      const wrongPassword = await login({
        email: TEST_USER.email,
        password: 'wrong-password',
      });
      const unknownEmail = await login({
        email: 'nobody@example.com',
        password: TEST_USER.password,
      });

      expect(unknownEmail.status).toBe(401);
      expect(unknownEmail.body).toEqual(wrongPassword.body);
    });

    it('rejects a malformed email with 400 and a list of messages', async () => {
      const response = await login({
        email: 'not-an-email',
        password: TEST_USER.password,
      }).expect(400);

      expect(response.body).toEqual({
        statusCode: 400,
        message: ['email must be a valid email address'],
        error: 'Bad Request',
      });
    });

    it('rejects an empty password with 400', async () => {
      const response = await login({
        email: TEST_USER.email,
        password: '',
      }).expect(400);

      expect(response.body.message).toContain('password must not be empty');
    });

    it('rejects an empty body with 400', async () => {
      await login({}).expect(400);
    });

    it('rejects properties it does not know', async () => {
      const response = await login({
        email: TEST_USER.email,
        password: TEST_USER.password,
        isAdmin: true,
      }).expect(400);

      expect(response.body.message).toContain(
        'property isAdmin should not exist',
      );
    });
  });

  describe('GET /auth/me', () => {
    it('returns the signed-in user and nothing secret', async () => {
      const response = await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${await accessToken()}`)
        .expect(200);

      expect(response.body).toEqual({
        id: userId,
        email: TEST_USER.email,
        fullname: TEST_USER.fullname,
      });
    });

    it('rejects a request without a token', async () => {
      const response = await http().get('/auth/me').expect(401);

      expect(response.body).toEqual({
        statusCode: 401,
        message: 'Authentication required',
        error: 'Unauthorized',
      });
    });

    it('rejects a tampered token', async () => {
      const token = await accessToken();
      const tampered = `${token.slice(0, -4)}AAAA`;

      await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${tampered}`)
        .expect(401);
    });

    it('rejects an expired token', async () => {
      const expired = await testApp.app
        .get(JwtService)
        .signAsync({ sub: userId, email: TEST_USER.email }, { expiresIn: -10 });

      const response = await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${expired}`)
        .expect(401);

      expect(response.body.message).toBe('Invalid or expired token');
    });

    it('stops accepting a token once its user is deleted', async () => {
      const token = await accessToken();
      await testApp.dataSource.query('DELETE FROM users WHERE id = $1', [
        userId,
      ]);

      await http()
        .get('/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      userId = (await testApp.createUser()).id;
    });
  });

  describe('API documentation', () => {
    it('describes both endpoints and marks /auth/me as needing a bearer token', async () => {
      const { body } = await http().get('/api/docs-json').expect(200);

      expect(Object.keys(body.paths)).toEqual(['/auth/login', '/auth/me']);
      expect(body.paths['/auth/me'].get.security).toEqual([{ bearer: [] }]);
      expect(
        Object.keys(body.paths['/auth/login'].post.responses).sort(),
      ).toEqual(['200', '400', '401', '429']);
    });
  });
});
