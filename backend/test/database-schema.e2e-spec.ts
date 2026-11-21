import { QueryFailedError } from 'typeorm';
import { createTestApp, type TestApp } from './support/test-app.js';

/** PostgreSQL error codes the application relies on. */
const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';
const INVALID_ENUM_VALUE = '22P02';
const FOREIGN_KEY_VIOLATION = '23503';

describe('Database schema (e2e)', () => {
  let testApp: TestApp;
  let userId: string;

  /**
   * Inserts an invoice, with any column overridden, and returns its id.
   * Override a column with `undefined` to leave it out and get its default.
   */
  async function insertInvoice(
    overrides: Record<string, unknown> = {},
  ): Promise<string> {
    const values: Record<string, unknown> = {
      invoice_number: `INV-${Math.random().toString(36).slice(2)}`,
      invoice_date: '2026-06-03',
      due_date: '2026-07-03',
      currency: 'AUD',
      currency_symbol: 'AU$',
      tax_rate: '10.00',
      invoice_sub_total: '2000.00',
      total_tax: '200.00',
      total_discount: '20.00',
      total_amount: '2180.00',
      total_paid: '0.00',
      balance_amount: '2180.00',
      customer_fullname: 'Paul',
      customer_email: 'paul@example.com',
      created_by: userId,
      ...overrides,
    };
    const invoice = Object.fromEntries(
      Object.entries(values).filter(([, value]) => value !== undefined),
    );
    const columns = Object.keys(invoice);
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    const [row] = await testApp.dataSource.query<{ id: string }[]>(
      `INSERT INTO invoices (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
      Object.values(invoice),
    );
    return row.id;
  }

  async function expectDatabaseError(
    action: Promise<unknown>,
    code: string,
  ): Promise<void> {
    const error = await action.then(
      () => undefined,
      (reason: unknown) => reason,
    );

    expect(error).toBeInstanceOf(QueryFailedError);
    expect(
      (error as QueryFailedError<Error & { code: string }>).driverError.code,
    ).toBe(code);
  }

  beforeAll(async () => {
    testApp = await createTestApp();
    const [user] = await testApp.dataSource.query<{ id: string }[]>(
      `INSERT INTO users (email, password_hash, fullname)
       VALUES ('reviewer@example.com', 'not-a-real-hash', 'Reviewer') RETURNING id`,
    );
    userId = user.id;
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  it('creates the tables on application start', async () => {
    const tables = await testApp.dataSource.query<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' ORDER BY table_name`,
    );

    expect(tables.map((table) => table.table_name)).toEqual([
      'invoice_items',
      'invoices',
      'migrations',
      'users',
    ]);
  });

  it('has nothing left to migrate, and entities match the schema', async () => {
    expect(await testApp.dataSource.showMigrations()).toBe(false);

    const drift = await testApp.dataSource.driver.createSchemaBuilder().log();
    expect(drift.upQueries.map((query) => query.query)).toEqual([]);
  });

  it('defaults a new invoice to Draft with nothing paid', async () => {
    const id = await insertInvoice({ total_paid: undefined });
    const [invoice] = await testApp.dataSource.query<
      { status: string; total_paid: string }[]
    >('SELECT status, total_paid FROM invoices WHERE id = $1', [id]);

    expect(invoice).toEqual({ status: 'Draft', total_paid: '0.00' });
  });

  describe('invoice number uniqueness', () => {
    it('rejects an exact duplicate', async () => {
      await insertInvoice({ invoice_number: 'IV-DUPLICATE' });

      await expectDatabaseError(
        insertInvoice({ invoice_number: 'IV-DUPLICATE' }),
        UNIQUE_VIOLATION,
      );
    });

    it('rejects a duplicate that differs only by letter case', async () => {
      await insertInvoice({ invoice_number: 'IV-Case-1' });

      await expectDatabaseError(
        insertInvoice({ invoice_number: 'iv-case-1' }),
        UNIQUE_VIOLATION,
      );
    });
  });

  describe('invoice constraints', () => {
    it('rejects a due date before the invoice date', async () => {
      await expectDatabaseError(
        insertInvoice({ invoice_date: '2026-06-03', due_date: '2026-06-02' }),
        CHECK_VIOLATION,
      );
    });

    it('accepts a due date equal to the invoice date', async () => {
      await expect(
        insertInvoice({ invoice_date: '2026-06-03', due_date: '2026-06-03' }),
      ).resolves.toBeDefined();
    });

    it('refuses to store Overdue as a status', async () => {
      await expectDatabaseError(
        insertInvoice({ status: 'Overdue' }),
        INVALID_ENUM_VALUE,
      );
    });

    it('rejects a total that does not equal subtotal plus tax minus discount', async () => {
      await expectDatabaseError(
        insertInvoice({ total_amount: '9999.00', balance_amount: '9999.00' }),
        CHECK_VIOLATION,
      );
    });

    it('rejects a balance that does not equal total minus paid', async () => {
      await expectDatabaseError(
        insertInvoice({ total_paid: '100.00', balance_amount: '2180.00' }),
        CHECK_VIOLATION,
      );
    });

    it('rejects a negative amount', async () => {
      await expectDatabaseError(
        insertInvoice({
          total_discount: '-20.00',
          total_amount: '2220.00',
          balance_amount: '2220.00',
        }),
        CHECK_VIOLATION,
      );
    });

    it('rejects an invoice whose creator does not exist', async () => {
      await expectDatabaseError(
        insertInvoice({ created_by: '00000000-0000-0000-0000-000000000000' }),
        FOREIGN_KEY_VIOLATION,
      );
    });
  });

  describe('invoice items', () => {
    const insertItem = (invoiceId: string, quantity: number, rate: string) =>
      testApp.dataSource.query(
        `INSERT INTO invoice_items (invoice_id, name, quantity, rate) VALUES ($1, 'Honda RC150', $2, $3)`,
        [invoiceId, quantity, rate],
      );

    it('rejects a quantity of zero', async () => {
      const invoiceId = await insertInvoice();

      await expectDatabaseError(
        insertItem(invoiceId, 0, '1000.00'),
        CHECK_VIOLATION,
      );
    });

    it('rejects a rate of zero', async () => {
      const invoiceId = await insertInvoice();

      await expectDatabaseError(
        insertItem(invoiceId, 2, '0.00'),
        CHECK_VIOLATION,
      );
    });

    it('is deleted together with its invoice', async () => {
      const invoiceId = await insertInvoice();
      await insertItem(invoiceId, 2, '1000.00');

      await testApp.dataSource.query('DELETE FROM invoices WHERE id = $1', [
        invoiceId,
      ]);
      const [remaining] = await testApp.dataSource.query<{ count: string }[]>(
        'SELECT count(*) FROM invoice_items WHERE invoice_id = $1',
        [invoiceId],
      );

      expect(remaining.count).toBe('0');
    });
  });

  describe('users', () => {
    const insertUser = (email: string) =>
      testApp.dataSource.query(
        `INSERT INTO users (email, password_hash, fullname) VALUES ($1, 'hash', 'Someone')`,
        [email],
      );

    it('rejects a duplicate email', async () => {
      await expectDatabaseError(
        insertUser('reviewer@example.com'),
        UNIQUE_VIOLATION,
      );
    });

    it('rejects an email that is not lower-cased', async () => {
      await expectDatabaseError(
        insertUser('Reviewer@Example.com'),
        CHECK_VIOLATION,
      );
    });
  });
});
