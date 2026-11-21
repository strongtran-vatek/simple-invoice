import request from 'supertest';
import { seedInvoices } from '../src/database/seed/seed-invoices.js';
import { StoredInvoiceStatus } from '../src/invoices/invoice-status.enum.js';
import { insertInvoice } from './support/fixtures.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const TODAY = '2026-11-21';
const APPENDIX_INVOICE_ID = '099ca7da-a290-40fa-93b9-1c43ae7bb887';

describe('GET /invoices/:id (e2e)', () => {
  let testApp: TestApp;
  let authorization: string;
  let userId: string;

  const get = (id: string) =>
    request(testApp.app.getHttpServer())
      .get(`/invoices/${id}`)
      .set('Authorization', authorization);

  beforeAll(async () => {
    testApp = await createTestApp({ today: TODAY });
    authorization = await testApp.signIn();
    userId = (await testApp.createUser()).id;
    await seedInvoices(testApp.dataSource, { createdBy: userId, today: TODAY });
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('requires authentication', async () => {
    await request(testApp.app.getHttpServer())
      .get(`/invoices/${APPENDIX_INVOICE_ID}`)
      .expect(401);
  });

  it('returns the Appendix A invoice exactly as the specification gives it', async () => {
    const response = await get(APPENDIX_INVOICE_ID).expect(200);

    expect(response.body).toEqual({
      invoiceId: APPENDIX_INVOICE_ID,
      invoiceNumber: 'IV1780488206995',
      invoiceReference: '#5721662',
      invoiceDate: '2026-06-03',
      dueDate: '2026-07-03',
      currency: 'AUD',
      currencySymbol: 'AU$',
      description: 'Invoice is issued to Kanglee',
      // Stored as Pending; Overdue because the due date has passed.
      status: 'Overdue',
      taxRate: 10,
      invoiceSubTotal: 2000,
      totalTax: 200,
      totalDiscount: 20,
      totalAmount: 2180,
      totalPaid: 1451.34,
      balanceAmount: 728.66,
      customer: {
        fullname: 'Paul',
        email: 'paul@101digital.io',
        mobileNumber: '947717364111',
        address: 'Singapore',
      },
      items: [
        {
          id: 'b1c2d3e4-0000-0000-0000-000000000001',
          name: 'Honda RC150',
          quantity: 2,
          rate: 1000,
          amount: 2000,
        },
      ],
      createdAt: '2026-06-03T12:03:26.995Z',
      createdBy: userId,
    });
  });

  it('returns null for optional fields that were left empty', async () => {
    const invoice = await insertInvoice(testApp.dataSource, userId, {
      invoiceNumber: 'DETAIL-MINIMAL',
    });

    const response = await get(invoice.id).expect(200);

    expect(response.body).toMatchObject({
      invoiceReference: null,
      description: null,
      customer: { mobileNumber: null, address: null },
    });
  });

  it('returns amounts as numbers, to the cent', async () => {
    const invoice = await insertInvoice(testApp.dataSource, userId, {
      invoiceNumber: 'DETAIL-CENTS',
      quantity: 3,
      rate: '19.99',
      taxRate: '8.25',
      discount: '1.50',
      totalPaid: '10.00',
    });

    const response = await get(invoice.id).expect(200);

    // subtotal 59.97, tax 4.947525 → 4.95, total 63.42, balance 53.42
    expect(response.body).toMatchObject({
      taxRate: 8.25,
      invoiceSubTotal: 59.97,
      totalTax: 4.95,
      totalDiscount: 1.5,
      totalAmount: 63.42,
      totalPaid: 10,
      balanceAmount: 53.42,
      items: [{ quantity: 3, rate: 19.99, amount: 59.97 }],
    });
  });

  describe('status', () => {
    const statusOf = async (
      invoiceNumber: string,
      status: StoredInvoiceStatus,
      dueDate: string,
    ) => {
      const invoice = await insertInvoice(testApp.dataSource, userId, {
        invoiceNumber,
        status,
        invoiceDate: '2026-10-01',
        dueDate,
      });
      const response = await get(invoice.id).expect(200);
      return response.body.status as string;
    };

    it('is Overdue for an unpaid invoice past its due date', async () => {
      expect(
        await statusOf('STATUS-1', StoredInvoiceStatus.Draft, '2026-11-20'),
      ).toBe('Overdue');
    });

    it('is the stored status for an invoice due today', async () => {
      expect(
        await statusOf('STATUS-2', StoredInvoiceStatus.Pending, TODAY),
      ).toBe('Pending');
    });

    it('stays Paid however long ago the invoice fell due', async () => {
      expect(
        await statusOf('STATUS-3', StoredInvoiceStatus.Paid, '2026-10-02'),
      ).toBe('Paid');
    });
  });

  it('agrees with the list about the same invoice', async () => {
    const list = await request(testApp.app.getHttpServer())
      .get('/invoices')
      .query({ keyword: 'INV-0007' })
      .set('Authorization', authorization)
      .expect(200);
    const [row] = list.body.data;

    const detail = await get(row.invoiceId).expect(200);

    // Every field of a list row appears in the detail with the same value.
    expect(detail.body).toMatchObject(row);
  });

  it('answers 404 for an id that does not exist', async () => {
    const response = await get('3f2504e0-4f89-41d3-9a0c-0305e82c3301').expect(
      404,
    );

    expect(response.body).toEqual({
      statusCode: 404,
      message: 'Invoice not found',
      error: 'Not Found',
    });
  });

  it.each(['not-a-uuid', '123', "1' OR '1'='1"])(
    'answers 400 for the malformed id %s',
    async (id) => {
      const response = await get(encodeURIComponent(id)).expect(400);

      expect(response.body).toEqual({
        statusCode: 400,
        message: 'id must be a valid UUID',
        error: 'Bad Request',
      });
    },
  );

  it('is described in the OpenAPI document', async () => {
    const { body } = await request(testApp.app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    const operation = body.paths['/invoices/{id}'].get;

    expect(Object.keys(operation.responses).sort()).toEqual([
      '200',
      '400',
      '401',
      '404',
    ]);
    expect(
      Object.keys(body.components.schemas.InvoiceDetailDto.properties),
    ).toEqual(
      expect.arrayContaining([
        'invoiceId',
        'invoiceNumber',
        'status',
        'customer',
        'items',
        'invoiceSubTotal',
        'totalTax',
        'totalDiscount',
        'totalAmount',
        'balanceAmount',
      ]),
    );
  });
});
