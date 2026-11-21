import request from 'supertest';
import { StoredInvoiceStatus } from '../src/invoices/invoice-status.enum.js';
import { insertInvoice } from './support/fixtures.js';
import { createTestApp, type TestApp } from './support/test-app.js';

const TODAY = '2026-06-15';
const { Draft, Pending, Paid } = StoredInvoiceStatus;

interface Row {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  totalAmount: number;
}

describe('GET /invoices (e2e)', () => {
  let testApp: TestApp;
  let authorization: string;
  const ids: Record<string, string> = {};

  /** Calls the endpoint as the signed-in user. */
  const list = (query: Record<string, string | number> = {}) =>
    request(testApp.app.getHttpServer())
      .get('/invoices')
      .query(query)
      .set('Authorization', authorization);

  /** The invoice numbers returned for a query, in order. */
  async function numbers(
    query: Record<string, string | number>,
  ): Promise<string[]> {
    const response = await list(query).expect(200);
    return (response.body.data as Row[]).map((row) => row.invoiceNumber);
  }

  beforeAll(async () => {
    testApp = await createTestApp({ today: TODAY });
    authorization = await testApp.signIn();
    const user = await testApp.createUser();

    // Seven invoices chosen so each feature has a distinguishing case.
    const fixtures = [
      {
        invoiceNumber: 'INV-A001',
        customerFullname: 'Alice Johnson',
        invoiceDate: '2026-06-01',
        dueDate: '2026-06-30',
        status: Draft,
        rate: '9.00', // total 9.90: sorts wrongly if amounts are compared as text
      },
      {
        invoiceNumber: 'INV-A002',
        customerFullname: 'Bob Stone',
        invoiceDate: '2026-05-01',
        dueDate: '2026-05-31', // past due and still a Draft
        status: Draft,
        rate: '200.00',
      },
      {
        invoiceNumber: 'INV-B003',
        customerFullname: 'alice cooper',
        invoiceDate: '2026-06-10',
        dueDate: TODAY, // due today: not overdue yet
        status: Pending,
        rate: '300.00',
      },
      {
        invoiceNumber: 'INV-B004',
        customerFullname: 'Carol 50% Off_Ltd',
        invoiceDate: '2026-04-15',
        dueDate: '2026-06-14', // due yesterday
        status: Pending,
        rate: '400.00',
      },
      {
        invoiceNumber: 'inv-c005',
        customerFullname: 'Dave Paid',
        invoiceDate: '2026-03-01',
        dueDate: '2026-03-31', // long past due, but paid
        status: Paid,
        rate: '500.00',
        totalPaid: '550.00',
      },
      {
        invoiceNumber: 'INV-C006',
        customerFullname: 'Eve Adams',
        invoiceDate: '2026-06-12',
        dueDate: '2026-07-12',
        status: Paid,
        rate: '600.00',
        totalPaid: '660.00',
        currency: 'USD',
        currencySymbol: 'US$',
      },
      {
        invoiceNumber: 'INV-D007',
        customerFullname: 'Frank Under_score',
        invoiceDate: '2026-06-05',
        dueDate: '2026-07-05',
        status: Pending,
        rate: '300.00', // same total as INV-B003, to exercise the tiebreaker
      },
    ];
    for (const fixture of fixtures) {
      const invoice = await insertInvoice(testApp.dataSource, user.id, fixture);
      ids[fixture.invoiceNumber] = invoice.id;
    }
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('requires authentication', async () => {
    const response = await request(testApp.app.getHttpServer())
      .get('/invoices')
      .expect(401);

    expect(response.body.message).toBe('Authentication required');
  });

  describe('with no parameters', () => {
    it('returns the first page of 10, newest invoice date first', async () => {
      const response = await list().expect(200);

      expect(response.body.paging).toEqual({ page: 1, pageSize: 10, total: 7 });
      expect(
        (response.body.data as Row[]).map((row) => row.invoiceNumber),
      ).toEqual([
        'INV-C006',
        'INV-B003',
        'INV-D007',
        'INV-A001',
        'INV-A002',
        'INV-B004',
        'inv-c005',
      ]);
    });

    it('returns each row in the documented shape, with amounts as numbers', async () => {
      const response = await list().expect(200);

      expect(response.body.data[0]).toEqual({
        invoiceId: ids['INV-C006'],
        invoiceNumber: 'INV-C006',
        invoiceDate: '2026-06-12',
        dueDate: '2026-07-12',
        currency: 'USD',
        currencySymbol: 'US$',
        totalAmount: 660,
        status: 'Paid',
        customer: { fullname: 'Eve Adams' },
      });
    });
  });

  describe('search', () => {
    it('matches part of a customer name, ignoring case', async () => {
      expect(await numbers({ keyword: 'ALICE' })).toEqual([
        'INV-B003',
        'INV-A001',
      ]);
    });

    it('matches part of an invoice number, ignoring case', async () => {
      expect(await numbers({ keyword: 'inv-c' })).toEqual([
        'INV-C006',
        'inv-c005',
      ]);
      expect(await numbers({ keyword: 'b00' })).toEqual([
        'INV-B003',
        'INV-B004',
      ]);
    });

    it('ignores surrounding spaces', async () => {
      expect(await numbers({ keyword: '  eve  ' })).toEqual(['INV-C006']);
    });

    it('treats % and _ as ordinary characters, not wildcards', async () => {
      expect(await numbers({ keyword: '50%' })).toEqual(['INV-B004']);
      expect(await numbers({ keyword: '%' })).toEqual(['INV-B004']);
      expect(await numbers({ keyword: '_' })).toEqual(['INV-D007', 'INV-B004']);
    });

    it('returns an empty page when nothing matches', async () => {
      const response = await list({ keyword: 'no-such-invoice' }).expect(200);

      expect(response.body).toEqual({
        data: [],
        paging: { page: 1, pageSize: 10, total: 0 },
      });
    });

    it('is not a route to SQL injection', async () => {
      expect(await numbers({ keyword: "' OR '1'='1" })).toEqual([]);
    });
  });

  describe('status filter', () => {
    it('Overdue returns unpaid invoices past their due date, Drafts included', async () => {
      expect(await numbers({ status: 'Overdue' })).toEqual([
        'INV-A002',
        'INV-B004',
      ]);
    });

    it('Draft excludes a Draft that is overdue', async () => {
      expect(await numbers({ status: 'Draft' })).toEqual(['INV-A001']);
    });

    it('Pending excludes an overdue one but keeps one due today', async () => {
      expect(await numbers({ status: 'Pending' })).toEqual([
        'INV-B003',
        'INV-D007',
      ]);
    });

    it('Paid includes a paid invoice whose due date has passed', async () => {
      expect(await numbers({ status: 'Paid' })).toEqual([
        'INV-C006',
        'inv-c005',
      ]);
    });

    it('labels every row with the status it was filtered by', async () => {
      for (const status of ['Draft', 'Pending', 'Paid', 'Overdue']) {
        const response = await list({ status }).expect(200);
        const statuses = (response.body.data as Row[]).map((row) => row.status);

        expect(statuses.length).toBeGreaterThan(0);
        expect(new Set(statuses)).toEqual(new Set([status]));
      }
    });

    it('puts every invoice under exactly one status', async () => {
      const all = await Promise.all(
        ['Draft', 'Pending', 'Paid', 'Overdue'].map((status) =>
          numbers({ status }),
        ),
      );

      expect(all.flat().sort()).toEqual((await numbers({})).sort());
    });

    it('reports the filtered total, not the table size', async () => {
      const response = await list({ status: 'Overdue' }).expect(200);

      expect(response.body.paging.total).toBe(2);
    });
  });

  describe('sorting', () => {
    it('sorts by due date ascending', async () => {
      expect(await numbers({ sortBy: 'dueDate', ordering: 'ASC' })).toEqual([
        'inv-c005',
        'INV-A002',
        'INV-B004',
        'INV-B003',
        'INV-A001',
        'INV-D007',
        'INV-C006',
      ]);
    });

    it('sorts by invoice date ascending', async () => {
      expect(await numbers({ sortBy: 'invoiceDate', ordering: 'ASC' })).toEqual(
        [
          'inv-c005',
          'INV-B004',
          'INV-A002',
          'INV-A001',
          'INV-D007',
          'INV-B003',
          'INV-C006',
        ],
      );
    });

    it('sorts by total amount numerically, in both directions', async () => {
      const response = await list({
        sortBy: 'totalAmount',
        ordering: 'ASC',
      }).expect(200);
      const ascending = (response.body.data as Row[]).map(
        (row) => row.totalAmount,
      );

      expect(ascending).toEqual([9.9, 220, 330, 330, 440, 550, 660]);

      const descending = await list({
        sortBy: 'totalAmount',
        ordering: 'DESC',
      }).expect(200);
      expect(
        (descending.body.data as Row[]).map((row) => row.totalAmount),
      ).toEqual([660, 550, 440, 330, 330, 220, 9.9]);
    });

    it('orders rows with equal values by id, so the order is stable', async () => {
      const response = await list({
        sortBy: 'totalAmount',
        ordering: 'ASC',
      }).expect(200);
      const tied = (response.body.data as Row[])
        .filter((row) => row.totalAmount === 330)
        .map((row) => row.invoiceId);

      expect(tied).toEqual([...tied].sort());
    });

    it('accepts the ordering in lower case', async () => {
      expect((await numbers({ sortBy: 'dueDate', ordering: 'asc' }))[0]).toBe(
        'inv-c005',
      );
    });
  });

  describe('pagination', () => {
    it('returns the requested page and the overall total', async () => {
      const response = await list({ page: 2, pageSize: 3 }).expect(200);

      expect(response.body.paging).toEqual({ page: 2, pageSize: 3, total: 7 });
      expect(
        (response.body.data as Row[]).map((row) => row.invoiceNumber),
      ).toEqual(['INV-A001', 'INV-A002', 'INV-B004']);
    });

    it('returns a short last page', async () => {
      expect(await numbers({ page: 3, pageSize: 3 })).toEqual(['inv-c005']);
    });

    it('returns an empty page, with the total, beyond the last page', async () => {
      const response = await list({ page: 4, pageSize: 3 }).expect(200);

      expect(response.body).toEqual({
        data: [],
        paging: { page: 4, pageSize: 3, total: 7 },
      });
    });

    it('covers every invoice exactly once across the pages', async () => {
      const pages = await Promise.all(
        [1, 2, 3, 4].map((page) => numbers({ page, pageSize: 2 })),
      );

      expect(pages.map((page) => page.length)).toEqual([2, 2, 2, 1]);
      expect(new Set(pages.flat()).size).toBe(7);
    });

    it('accepts the largest page size', async () => {
      const response = await list({ pageSize: 100 }).expect(200);

      expect(response.body.paging.pageSize).toBe(100);
    });
  });

  describe('date range', () => {
    it('includes both end dates', async () => {
      expect(
        await numbers({ fromDate: '2026-06-01', toDate: '2026-06-10' }),
      ).toEqual(['INV-B003', 'INV-D007', 'INV-A001']);
    });

    it('accepts either end alone', async () => {
      expect(await numbers({ fromDate: '2026-06-10' })).toEqual([
        'INV-C006',
        'INV-B003',
      ]);
      expect(await numbers({ toDate: '2026-04-15' })).toEqual([
        'INV-B004',
        'inv-c005',
      ]);
    });
  });

  it('combines search, status, sort and paging', async () => {
    const response = await list({
      keyword: 'inv-',
      status: 'Pending',
      sortBy: 'invoiceDate',
      ordering: 'ASC',
      page: 1,
      pageSize: 1,
    }).expect(200);

    expect(response.body.paging).toEqual({ page: 1, pageSize: 1, total: 2 });
    expect(response.body.data[0].invoiceNumber).toBe('INV-D007');
  });

  it('treats blank parameters as absent', async () => {
    const response = await list({
      status: '',
      keyword: '',
      sortBy: '',
      ordering: '',
      fromDate: '',
      toDate: '',
    }).expect(200);

    expect(response.body.paging.total).toBe(7);
  });

  describe('validation', () => {
    it.each([
      [{ page: 0 }, 'page must not be less than 1'],
      [{ page: 1.5 }, 'page must be an integer number'],
      [{ page: 'two' }, 'page must be an integer number'],
      [{ pageSize: 0 }, 'pageSize must not be less than 1'],
      [{ pageSize: 101 }, 'pageSize must not be greater than 100'],
      [
        { sortBy: 'createdAt' },
        'sortBy must be one of: invoiceDate, dueDate, totalAmount',
      ],
      [{ ordering: 'up' }, 'ordering must be ASC or DESC'],
      [
        { status: 'Late' },
        'status must be one of: Draft, Pending, Paid, Overdue',
      ],
      [
        { fromDate: '2026-13-01' },
        'fromDate must be a valid date in YYYY-MM-DD format',
      ],
      [
        { toDate: '15/06/2026' },
        'toDate must be a valid date in YYYY-MM-DD format',
      ],
      [
        { fromDate: '2026-06-10', toDate: '2026-06-01' },
        'toDate must be on or after fromDate',
      ],
      [{ limit: 5 }, 'property limit should not exist'],
    ])('rejects %j with 400', async (query, message) => {
      const response = await list(
        query as Record<string, string | number>,
      ).expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
      });
      expect(response.body.message).toContain(message);
    });
  });

  it('is described in the OpenAPI document with all its parameters', async () => {
    const { body } = await request(testApp.app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);
    const operation = body.paths['/invoices'].get;

    expect(
      (operation.parameters as { name: string }[])
        .map((parameter) => parameter.name)
        .sort(),
    ).toEqual([
      'fromDate',
      'keyword',
      'ordering',
      'page',
      'pageSize',
      'sortBy',
      'status',
      'toDate',
    ]);
    expect(Object.keys(operation.responses).sort()).toEqual([
      '200',
      '400',
      '401',
    ]);
    expect(operation.security).toEqual([{ bearer: [] }]);
  });
});
