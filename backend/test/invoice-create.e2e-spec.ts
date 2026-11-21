import request from 'supertest';
import { Invoice } from '../src/invoices/invoice.entity.js';
import { createTestApp, TEST_USER, type TestApp } from './support/test-app.js';

const TODAY = '2026-06-15';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Body = Record<string, unknown>;

describe('POST /invoices (e2e)', () => {
  let testApp: TestApp;
  let authorization: string;
  let userId: string;
  let sequence = 0;

  /** A valid request with an invoice number no other test has used. */
  const validBody = (changes: Body = {}): Body => ({
    invoiceNumber: `E2E-${++sequence}`,
    invoiceDate: '2026-06-10',
    dueDate: '2026-07-10',
    currency: 'AUD',
    customer: { fullname: 'Paul', email: 'paul@101digital.io' },
    items: [{ name: 'Honda RC150', quantity: 2, rate: 1000 }],
    ...changes,
  });

  const create = (body: Body) =>
    request(testApp.app.getHttpServer())
      .post('/invoices')
      .set('Authorization', authorization)
      .send(body);

  const list = (query: Record<string, string | number> = {}) =>
    request(testApp.app.getHttpServer())
      .get('/invoices')
      .query(query)
      .set('Authorization', authorization);

  const countInvoices = () => testApp.dataSource.getRepository(Invoice).count();

  beforeAll(async () => {
    testApp = await createTestApp({ today: TODAY });
    authorization = await testApp.signIn();
    userId = (await testApp.createUser()).id;
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('requires authentication', async () => {
    await request(testApp.app.getHttpServer())
      .post('/invoices')
      .send(validBody())
      .expect(401);
  });

  describe('the workflow: create an invoice, then see it in the list', () => {
    it('lists the new invoice and serves its detail', async () => {
      const created = await create(
        validBody({
          invoiceNumber: 'WORKFLOW-1',
          customer: { fullname: 'Workflow Customer', email: 'wf@example.com' },
        }),
      ).expect(201);

      const listed = await list({ keyword: 'workflow-1' }).expect(200);
      expect(listed.body.paging.total).toBe(1);
      expect(listed.body.data[0]).toEqual({
        invoiceId: created.body.invoiceId,
        invoiceNumber: 'WORKFLOW-1',
        invoiceDate: '2026-06-10',
        dueDate: '2026-07-10',
        currency: 'AUD',
        currencySymbol: 'AU$',
        totalAmount: 2200,
        status: 'Draft',
        customer: { fullname: 'Workflow Customer' },
      });

      // It is found by customer name and under the Draft filter too.
      const byCustomer = await list({ keyword: 'workflow cust' }).expect(200);
      expect(byCustomer.body.data).toHaveLength(1);
      const drafts = await list({ status: 'Draft', pageSize: 100 }).expect(200);
      expect(
        drafts.body.data.map((row: { invoiceId: string }) => row.invoiceId),
      ).toContain(created.body.invoiceId);

      const detail = await request(testApp.app.getHttpServer())
        .get(`/invoices/${created.body.invoiceId}`)
        .set('Authorization', authorization)
        .expect(200);
      expect(detail.body).toEqual(created.body);
    });
  });

  describe('a successful request', () => {
    it('returns 201 with the full invoice, as in Appendix A', async () => {
      const response = await create({
        invoiceNumber: 'IV-APPENDIX',
        invoiceReference: '#5721662',
        invoiceDate: '2026-06-03',
        dueDate: '2026-07-03',
        currency: 'AUD',
        description: 'Invoice is issued to Kanglee',
        customer: {
          fullname: 'Paul',
          email: 'paul@101digital.io',
          mobileNumber: '947717364111',
          address: 'Singapore',
        },
        items: [{ name: 'Honda RC150', quantity: 2, rate: 1000 }],
        tax: 10,
        discount: 20,
      }).expect(201);

      expect(response.body).toEqual({
        invoiceId: expect.stringMatching(UUID),
        invoiceNumber: 'IV-APPENDIX',
        invoiceReference: '#5721662',
        invoiceDate: '2026-06-03',
        dueDate: '2026-07-03',
        currency: 'AUD',
        currencySymbol: 'AU$',
        description: 'Invoice is issued to Kanglee',
        status: 'Draft',
        taxRate: 10,
        invoiceSubTotal: 2000,
        totalTax: 200,
        totalDiscount: 20,
        totalAmount: 2180,
        totalPaid: 0,
        balanceAmount: 2180,
        customer: {
          fullname: 'Paul',
          email: 'paul@101digital.io',
          mobileNumber: '947717364111',
          address: 'Singapore',
        },
        items: [
          {
            id: expect.stringMatching(UUID),
            name: 'Honda RC150',
            quantity: 2,
            rate: 1000,
            amount: 2000,
          },
        ],
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/),
        createdBy: userId,
      });
    });

    it('stores the invoice as a Draft with one line item', async () => {
      const response = await create(validBody()).expect(201);

      const stored = await testApp.dataSource
        .getRepository(Invoice)
        .findOneOrFail({
          where: { id: response.body.invoiceId },
          relations: { items: true },
        });
      expect(stored.status).toBe('Draft');
      expect(stored.createdBy).toBe(userId);
      expect(stored.items).toHaveLength(1);
      expect(stored.totalAmount).toBe('2200.00');
    });

    it('defaults tax to 10% and discount to 0', async () => {
      const response = await create(validBody()).expect(201);

      expect(response.body).toMatchObject({
        taxRate: 10,
        invoiceSubTotal: 2000,
        totalTax: 200,
        totalDiscount: 0,
        totalAmount: 2200,
        balanceAmount: 2200,
      });
    });

    it('accepts a tax of 0', async () => {
      const response = await create(validBody({ tax: 0 })).expect(201);

      expect(response.body).toMatchObject({ totalTax: 0, totalAmount: 2000 });
    });

    it('calculates the amounts in cents, rounding tax half-up', async () => {
      const response = await create(
        validBody({
          items: [{ name: 'Widget', quantity: 3, rate: 19.99 }],
          tax: 7.5,
          discount: 0.47,
        }),
      ).expect(201);

      expect(response.body).toMatchObject({
        invoiceSubTotal: 59.97,
        // 59.97 × 7.5% = 4.49775
        totalTax: 4.5,
        totalDiscount: 0.47,
        totalAmount: 64,
        balanceAmount: 64,
      });
    });

    it('charges tax on the subtotal before the discount', async () => {
      const response = await create(
        validBody({
          items: [{ name: 'Service', quantity: 1, rate: 100 }],
          tax: 10,
          discount: 50,
        }),
      ).expect(201);

      expect(response.body).toMatchObject({ totalTax: 10, totalAmount: 60 });
    });

    it('accepts a discount equal to the subtotal plus tax', async () => {
      const response = await create(
        validBody({
          items: [{ name: 'Gift', quantity: 1, rate: 100 }],
          discount: 110,
        }),
      ).expect(201);

      expect(response.body).toMatchObject({ totalAmount: 0, balanceAmount: 0 });
    });

    it('derives the currency symbol from the currency', async () => {
      const response = await create(validBody({ currency: 'gbp' })).expect(201);

      expect(response.body).toMatchObject({
        currency: 'GBP',
        currencySymbol: '£',
      });
    });

    it('returns null for optional fields that were left out or blank', async () => {
      const response = await create(
        validBody({
          invoiceReference: '   ',
          customer: { fullname: 'Paul', email: 'paul@101digital.io' },
        }),
      ).expect(201);

      expect(response.body.invoiceReference).toBeNull();
      expect(response.body.description).toBeNull();
      expect(response.body.customer.mobileNumber).toBeNull();
      expect(response.body.customer.address).toBeNull();
    });

    it('records the signed-in user as the creator', async () => {
      const response = await create(validBody()).expect(201);

      const me = await request(testApp.app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', authorization)
        .expect(200);
      expect(me.body.email).toBe(TEST_USER.email);
      expect(response.body.createdBy).toBe(me.body.id);
    });

    it('shows a new invoice as Overdue when its due date has already passed', async () => {
      // Overdue is derived at read time, even for a Draft created today.
      const response = await create(
        validBody({ invoiceDate: '2026-05-01', dueDate: '2026-05-31' }),
      ).expect(201);

      expect(response.body.status).toBe('Overdue');
    });
  });

  describe('a unique invoice number', () => {
    it('rejects a number that is already in use with 409', async () => {
      await create(validBody({ invoiceNumber: 'DUP-1' })).expect(201);
      const before = await countInvoices();

      const response = await create(
        validBody({ invoiceNumber: 'DUP-1' }),
      ).expect(409);

      expect(response.body).toEqual({
        statusCode: 409,
        message: 'An invoice with this invoice number already exists',
        error: 'Conflict',
      });
      expect(await countInvoices()).toBe(before);
    });

    it('ignores letter case and surrounding spaces when comparing', async () => {
      await create(validBody({ invoiceNumber: 'Dup-Case-1' })).expect(201);

      await create(validBody({ invoiceNumber: 'DUP-CASE-1' })).expect(409);
      await create(validBody({ invoiceNumber: '  dup-case-1  ' })).expect(409);
    });

    it('stores the number trimmed, in the case it was typed', async () => {
      const response = await create(
        validBody({ invoiceNumber: '  Mixed-Case-7  ' }),
      ).expect(201);

      expect(response.body.invoiceNumber).toBe('Mixed-Case-7');
    });

    it('lets only one of several simultaneous requests through', async () => {
      const responses = await Promise.all(
        Array.from({ length: 5 }, () =>
          create(validBody({ invoiceNumber: 'RACE-1' })),
        ),
      );

      const statuses = responses.map((response) => response.status).sort();
      expect(statuses).toEqual([201, 409, 409, 409, 409]);
    });

    it('leaves no line item behind when the invoice is rejected', async () => {
      await create(validBody({ invoiceNumber: 'ORPHAN-1' })).expect(201);
      const [{ count: before }] = await testApp.dataSource.query(
        'SELECT count(*)::int AS count FROM invoice_items',
      );

      await create(validBody({ invoiceNumber: 'ORPHAN-1' })).expect(409);

      const [{ count: after }] = await testApp.dataSource.query(
        'SELECT count(*)::int AS count FROM invoice_items',
      );
      expect(after).toBe(before);
    });
  });

  describe('validation', () => {
    it.each([
      [
        'a due date before the invoice date',
        { invoiceDate: '2026-06-10', dueDate: '2026-06-09' },
        'dueDate must be on or after invoiceDate',
      ],
      [
        'an invalid customer email',
        { customer: { fullname: 'Paul', email: 'not-an-email' } },
        'customer.email must be a valid email address',
      ],
      [
        'a blank customer name',
        { customer: { fullname: ' ', email: 'paul@101digital.io' } },
        'customer.fullname must not be empty',
      ],
      [
        'a blank invoice number',
        { invoiceNumber: '  ' },
        'invoiceNumber must not be empty',
      ],
      [
        'an invoice date that is not a date',
        { invoiceDate: '10/06/2026' },
        'invoiceDate must be a valid date in YYYY-MM-DD format',
      ],
      [
        'an unsupported currency',
        { currency: 'JPY' },
        'currency must be one of: AUD, USD, GBP, EUR, SGD, VND',
      ],
      [
        'a quantity that is not a positive integer',
        { items: [{ name: 'Widget', quantity: 0, rate: 10 }] },
        'items.0.quantity must not be less than 1',
      ],
      [
        'a rate that is not positive',
        { items: [{ name: 'Widget', quantity: 1, rate: 0 }] },
        'items.0.rate must be greater than 0',
      ],
      [
        'a blank item name',
        { items: [{ name: '', quantity: 1, rate: 10 }] },
        'items.0.name must not be empty',
      ],
      ['a negative tax', { tax: -1 }, 'tax must not be less than 0'],
      [
        'a negative discount',
        { discount: -1 },
        'discount must not be less than 0',
      ],
      [
        'more than one line item',
        {
          items: [
            { name: 'One', quantity: 1, rate: 10 },
            { name: 'Two', quantity: 1, rate: 10 },
          ],
        },
        'items must contain exactly one item',
      ],
      [
        'a status chosen by the client',
        { status: 'Paid' },
        'property status should not exist',
      ],
      [
        'a total chosen by the client',
        { totalAmount: 1 },
        'property totalAmount should not exist',
      ],
    ])('rejects %s with 400', async (_description, changes, message) => {
      const before = await countInvoices();

      const response = await create(validBody(changes)).expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
      });
      expect(response.body.message).toContain(message);
      expect(await countInvoices()).toBe(before);
    });

    it('rejects a discount larger than the subtotal plus tax', async () => {
      const response = await create(
        validBody({
          items: [{ name: 'Widget', quantity: 1, rate: 100 }],
          tax: 10,
          discount: 110.01,
        }),
      ).expect(400);

      expect(response.body).toEqual({
        statusCode: 400,
        message: 'discount must not exceed the subtotal plus tax',
        error: 'Bad Request',
      });
    });

    it('rejects an invoice too large to be recorded, without a server error', async () => {
      const response = await create(
        validBody({
          items: [{ name: 'Tower', quantity: 1_000_000, rate: 999_999_999.99 }],
        }),
      ).expect(400);

      expect(response.body.message).toBe(
        'The invoice amount is too large to be recorded',
      );
    });

    it('accepts the largest amount the database can hold', async () => {
      // 999 × 500,500,500.50 = 499,999,999,999.50, doubled by 100% tax.
      const response = await create(
        validBody({
          items: [{ name: 'Tower', quantity: 999, rate: 500_500_500.5 }],
          tax: 100,
        }),
      ).expect(201);

      expect(response.body.totalAmount).toBe(999_999_999_999);
    });

    it('rejects an empty body, naming every missing field', async () => {
      const response = await create({}).expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([
          'invoiceNumber must not be empty',
          'invoiceDate must be a valid date in YYYY-MM-DD format',
          'dueDate must be a valid date in YYYY-MM-DD format',
          'customer must be an object',
          'items must contain exactly one item',
        ]),
      );
    });
  });

  it('is described in the OpenAPI document', async () => {
    const { body } = await request(testApp.app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    const operation = body.paths['/invoices'].post;

    expect(Object.keys(operation.responses).sort()).toEqual([
      '201',
      '400',
      '401',
      '409',
    ]);
    expect(operation.requestBody.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/CreateInvoiceDto',
    });
    expect(body.components.schemas.CreateInvoiceDto.required.sort()).toEqual([
      'currency',
      'customer',
      'dueDate',
      'invoiceDate',
      'invoiceNumber',
      'items',
    ]);
    expect(operation.security).toEqual([{ bearer: [] }]);
  });
});
