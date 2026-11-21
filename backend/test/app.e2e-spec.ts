import request from 'supertest';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('Application (e2e)', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('connects to the database named by the environment, not a .env file', async () => {
    const [row] = await testApp.dataSource.query<{ name: string }[]>(
      'SELECT current_database() AS name',
    );

    expect(row.name).toBe(testApp.databaseName);
  });

  it('serves the OpenAPI document under /api/docs', async () => {
    const response = await request(testApp.app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);

    expect(response.body.info.title).toBe('SimpleInvoice API');
  });

  it('serves the Swagger UI page', async () => {
    await request(testApp.app.getHttpServer())
      .get('/api/docs')
      .expect(200)
      .expect('Content-Type', /html/);
  });

  it('answers an unknown route with the standard error shape', async () => {
    const response = await request(testApp.app.getHttpServer())
      .get('/no-such-route')
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      message: 'Cannot GET /no-such-route',
      error: 'Not Found',
    });
  });

  it('allows the configured frontend origin and no other', async () => {
    const allowed = await request(testApp.app.getHttpServer())
      .get('/api/docs-json')
      .set('Origin', 'http://localhost:8080');
    const other = await request(testApp.app.getHttpServer())
      .get('/api/docs-json')
      .set('Origin', 'http://evil.example');

    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:8080',
    );
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });
});
