import request from 'supertest';
import { createTestApp, type TestApp } from './support/test-app.js';

interface Schema {
  type?: string;
  $ref?: string;
  description?: string;
  properties?: Record<string, Schema>;
}

interface Operation {
  summary?: string;
  tags?: string[];
  security?: Record<string, string[]>[];
  parameters?: { name: string; description?: string; schema: Schema }[];
  responses: Record<
    string,
    { description?: string; content?: Record<string, { schema?: Schema }> }
  >;
}

interface OpenApiDocument {
  info: { description: string };
  tags: { name: string; description?: string }[];
  paths: Record<string, Record<string, Operation>>;
  components: {
    schemas: Record<string, Schema>;
    securitySchemes: Record<string, { type: string; scheme: string }>;
  };
}

/**
 * Checks the OpenAPI document as a whole, so an endpoint added later cannot be
 * left half-documented. What each endpoint documents is checked beside its
 * own tests.
 */
describe('API documentation (e2e)', () => {
  let testApp: TestApp;
  let document: OpenApiDocument;
  let operations: [name: string, operation: Operation][];

  beforeAll(async () => {
    testApp = await createTestApp();
    const response = await request(testApp.app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    document = response.body as OpenApiDocument;
    operations = Object.entries(document.paths).flatMap(([path, methods]) =>
      Object.entries(methods).map(
        ([method, operation]): [string, Operation] => [
          `${method.toUpperCase()} ${path}`,
          operation,
        ],
      ),
    );
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('documents the endpoints of the specification and the two probes', () => {
    expect(operations.map(([name]) => name).sort()).toEqual([
      'GET /auth/me',
      'GET /health',
      'GET /invoices',
      'GET /invoices/{id}',
      'GET /ready',
      'POST /auth/login',
      'POST /invoices',
    ]);
  });

  it('explains how to authorise and what the conventions are', () => {
    expect(document.info.description).toContain('POST /auth/login');
    expect(document.info.description).toContain('Authorize');
    expect(document.info.description).toContain('YYYY-MM-DD');
    expect(document.info.description).toContain('Overdue');
    expect(document.components.securitySchemes.bearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
  });

  it('gives every operation a summary and a described tag', () => {
    const describedTags = document.tags
      .filter((tag) => tag.description)
      .map((tag) => tag.name);

    for (const [name, operation] of operations) {
      expect(operation.summary, name).toBeTruthy();
      expect(operation.tags, name).toHaveLength(1);
      expect(describedTags, name).toContain(operation.tags?.[0]);
    }
  });

  it('describes every response and gives each a body schema', () => {
    for (const [name, operation] of operations) {
      for (const [status, response] of Object.entries(operation.responses)) {
        expect(response.description, `${name} ${status}`).toBeTruthy();
        expect(
          response.content?.['application/json']?.schema?.$ref,
          `${name} ${status}`,
        ).toBeTruthy();
      }
    }
  });

  it('documents every error with the one error shape', () => {
    for (const [name, operation] of operations) {
      const errors = Object.entries(operation.responses).filter(
        ([status]) => Number(status) >= 400,
      );
      // Liveness checks nothing, so it has no way to fail.
      if (name !== 'GET /health') {
        expect(errors.length, name).toBeGreaterThan(0);
      }
      for (const [status, response] of errors) {
        expect(
          response.content?.['application/json']?.schema?.$ref,
          `${name} ${status}`,
        ).toBe('#/components/schemas/ErrorResponseDto');
      }
    }
  });

  it('marks every endpoint except login and the probes as needing the bearer token', () => {
    const open = ['POST /auth/login', 'GET /health', 'GET /ready'];

    for (const [name, operation] of operations) {
      if (open.includes(name)) {
        expect(operation.security, name).toBeUndefined();
      } else {
        expect(operation.security, name).toEqual([{ bearer: [] }]);
        expect(Object.keys(operation.responses), name).toContain('401');
      }
    }
  });

  it('describes every query and path parameter', () => {
    for (const [name, operation] of operations) {
      for (const parameter of operation.parameters ?? []) {
        expect(parameter.description, `${name} ${parameter.name}`).toBeTruthy();
      }
    }
  });

  it('types whole numbers as integers', () => {
    const { schemas } = document.components;
    const listParameters = Object.fromEntries(
      (document.paths['/invoices'].get.parameters ?? []).map((parameter) => [
        parameter.name,
        parameter.schema.type,
      ]),
    );

    expect(listParameters).toMatchObject({
      page: 'integer',
      pageSize: 'integer',
    });
    expect(schemas.PagingDto.properties).toMatchObject({
      page: { type: 'integer' },
      pageSize: { type: 'integer' },
      total: { type: 'integer' },
    });
    expect(schemas.CreateInvoiceItemDto.properties?.quantity.type).toBe(
      'integer',
    );
    expect(schemas.InvoiceItemDto.properties?.quantity.type).toBe('integer');
    // Amounts have cents, so they stay plain numbers.
    expect(schemas.InvoiceDetailDto.properties?.totalAmount.type).toBe(
      'number',
    );
  });

  it('keeps the token in Swagger UI across page reloads', async () => {
    const response = await request(testApp.app.getHttpServer())
      .get('/api/docs/swagger-ui-init.js')
      .expect(200);

    expect(response.text).toContain('"persistAuthorization": true');
  });
});
