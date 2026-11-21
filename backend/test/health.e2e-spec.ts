import request from 'supertest';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('Health probes (e2e)', () => {
  let testApp: TestApp;

  const get = (path: string) => request(testApp.app.getHttpServer()).get(path);

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  describe('GET /health', () => {
    it('says the process is running, without a token', async () => {
      const response = await get('/health').expect(200);

      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /ready', () => {
    it('reports the database as up, without a token', async () => {
      const response = await get('/ready').expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        info: { database: { status: 'up' } },
        error: {},
        details: { database: { status: 'up' } },
      });
    });

    it('opens nothing else to callers without a token', async () => {
      await get('/invoices').expect(401);
      await get('/auth/me').expect(401);
    });
  });

  // Last, because it disconnects this file's database for good.
  describe('when the database cannot be reached', () => {
    beforeAll(async () => {
      await testApp.dataSource.destroy();
    });

    it('GET /ready answers 503 in the standard error shape', async () => {
      const response = await get('/ready').expect(503);

      expect(response.body).toEqual({
        statusCode: 503,
        message: 'Not ready: database is down',
        error: 'Service Unavailable',
      });
    });

    it('GET /health still answers 200, since the process itself is fine', async () => {
      await get('/health').expect(200);
    });
  });
});
