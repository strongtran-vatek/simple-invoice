import request from 'supertest';
import {
  GENERATED_INVOICE_COUNT,
  seedInvoices,
} from '../src/database/seed/seed-invoices.js';
import { insertInvoice } from './support/fixtures.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const TODAY = '2026-11-21';
const SEEDED = 1 + GENERATED_INVOICE_COUNT;

describe('Seed: invoices (e2e)', () => {
  let testApp: TestApp;
  let authorization: string;
  let userId: string;

  const seed = (reset = false) =>
    seedInvoices(testApp.dataSource, {
      createdBy: userId,
      today: TODAY,
      reset,
    });

  async function count(table: 'invoices' | 'invoice_items'): Promise<number> {
    const [row] = await testApp.dataSource.query<{ count: string }[]>(
      `SELECT count(*) FROM ${table}`,
    );
    return Number(row.count);
  }

  const total = async (query: Record<string, string> = {}) => {
    const response = await request(testApp.app.getHttpServer())
      .get('/invoices')
      .query(query)
      .set('Authorization', authorization)
      .expect(200);
    return response.body.paging.total as number;
  };

  beforeAll(async () => {
    testApp = await createTestApp({ today: TODAY });
    authorization = await testApp.signIn();
    userId = (await testApp.createUser()).id;
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('inserts every invoice, each with one line item, past all database constraints', async () => {
    expect(await seed()).toBe(SEEDED);
    expect(await count('invoices')).toBe(SEEDED);
    expect(await count('invoice_items')).toBe(SEEDED);
  });

  it('stores only Draft, Pending and Paid', async () => {
    const rows = await testApp.dataSource.query<{ status: string }[]>(
      'SELECT DISTINCT status FROM invoices ORDER BY status',
    );

    expect(rows.map((row) => row.status)).toEqual(['Draft', 'Pending', 'Paid']);
  });

  it('gives the list something to show under every status filter', async () => {
    const totals = {
      Draft: await total({ status: 'Draft' }),
      Pending: await total({ status: 'Pending' }),
      Paid: await total({ status: 'Paid' }),
      Overdue: await total({ status: 'Overdue' }),
    };

    for (const matching of Object.values(totals)) {
      expect(matching).toBeGreaterThan(0);
    }
    expect(Object.values(totals).reduce((sum, n) => sum + n, 0)).toBe(SEEDED);
  });

  it('gives search and pagination something to work with', async () => {
    expect(await total({ keyword: 'bennett' })).toBeGreaterThan(1);
    expect(await total({ keyword: 'INV-00' })).toBeGreaterThan(1);
    expect(await total()).toBeGreaterThan(10);
  });

  it('reports the Appendix A invoice as Overdue once its due date has passed', async () => {
    const response = await request(testApp.app.getHttpServer())
      .get('/invoices')
      .query({ keyword: 'IV1780488206995' })
      .set('Authorization', authorization)
      .expect(200);

    expect(response.body.data).toEqual([
      expect.objectContaining({
        invoiceId: '099ca7da-a290-40fa-93b9-1c43ae7bb887',
        status: 'Overdue',
        totalAmount: 2180,
        customer: { fullname: 'Paul' },
      }),
    ]);
  });

  it('does nothing when invoices already exist', async () => {
    expect(await seed()).toBe(0);
    expect(await count('invoices')).toBe(SEEDED);
  });

  it('leaves invoices created through the app alone', async () => {
    await insertInvoice(testApp.dataSource, userId, {
      invoiceNumber: 'CREATED-BY-A-USER',
    });

    expect(await seed()).toBe(0);
    expect(await count('invoices')).toBe(SEEDED + 1);
  });

  it('replaces everything, line items included, with --reset', async () => {
    expect(await seed(true)).toBe(SEEDED);
    expect(await count('invoices')).toBe(SEEDED);
    expect(await count('invoice_items')).toBe(SEEDED);
    expect(await total({ keyword: 'CREATED-BY-A-USER' })).toBe(0);
  });
});
