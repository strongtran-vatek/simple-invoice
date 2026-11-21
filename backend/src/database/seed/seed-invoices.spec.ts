import { calculateInvoiceAmounts } from '../../invoices/invoice-calculator.js';
import {
  deriveInvoiceStatus,
  InvoiceStatus,
  StoredInvoiceStatus,
} from '../../invoices/invoice-status.enum.js';
import {
  addDays,
  buildSeedInvoices,
  GENERATED_INVOICE_COUNT,
} from './seed-invoices.js';

const TODAY = '2026-11-21';
const USER_ID = '0b9d7f0e-6f1a-4c53-9b0a-2f6f1c1d2e3f';

describe('addDays', () => {
  it('moves forwards and backwards across month and year ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2024-02-28', 2)).toBe('2024-03-01');
    expect(addDays('2026-06-15', 0)).toBe('2026-06-15');
  });
});

describe('buildSeedInvoices', () => {
  const invoices = buildSeedInvoices(TODAY, USER_ID);
  const generated = invoices.slice(1);

  it('contains the Appendix A record plus the generated invoices', () => {
    expect(invoices).toHaveLength(1 + GENERATED_INVOICE_COUNT);
    expect(GENERATED_INVOICE_COUNT).toBeGreaterThanOrEqual(20);
    expect(GENERATED_INVOICE_COUNT).toBeLessThanOrEqual(50);
  });

  it('keeps the Appendix A record as specified, stored as Pending', () => {
    expect(invoices[0]).toMatchObject({
      id: '099ca7da-a290-40fa-93b9-1c43ae7bb887',
      invoiceNumber: 'IV1780488206995',
      invoiceReference: '#5721662',
      invoiceDate: '2026-06-03',
      dueDate: '2026-07-03',
      currency: 'AUD',
      currencySymbol: 'AU$',
      status: StoredInvoiceStatus.Pending,
      invoiceSubTotal: '2000.00',
      totalTax: '200.00',
      totalDiscount: '20.00',
      totalAmount: '2180.00',
      totalPaid: '1451.34',
      balanceAmount: '728.66',
      customerFullname: 'Paul',
      customerEmail: 'paul@101digital.io',
      items: [{ name: 'Honda RC150', quantity: 2, rate: '1000.00' }],
    });
  });

  it('never stores Overdue, and uses all three storable statuses', () => {
    const stored = new Set(invoices.map((invoice) => invoice.status));

    expect(stored).toEqual(new Set(['Draft', 'Pending', 'Paid']));
  });

  it('yields all four effective statuses on the day it runs', () => {
    const effective = new Set(
      invoices.map((invoice) =>
        deriveInvoiceStatus(invoice.status!, invoice.dueDate!, TODAY),
      ),
    );

    expect(effective).toEqual(new Set(Object.values(InvoiceStatus)));
  });

  it('includes both overdue and not-yet-due Draft and Pending invoices', () => {
    for (const status of [
      StoredInvoiceStatus.Draft,
      StoredInvoiceStatus.Pending,
    ]) {
      const ofStatus = invoices.filter((invoice) => invoice.status === status);

      expect(ofStatus.some((invoice) => invoice.dueDate! < TODAY)).toBe(true);
      expect(ofStatus.some((invoice) => invoice.dueDate! >= TODAY)).toBe(true);
    }
  });

  it('gives every invoice a number that is unique ignoring case', () => {
    const numbers = invoices.map((invoice) =>
      invoice.invoiceNumber!.toLowerCase(),
    );

    expect(new Set(numbers).size).toBe(invoices.length);
  });

  it('gives every invoice exactly one line item', () => {
    for (const invoice of invoices) {
      expect(invoice.items).toHaveLength(1);
    }
  });

  it('never dates an invoice in the future or lets it fall due before it is issued', () => {
    for (const invoice of generated) {
      expect(invoice.invoiceDate! <= TODAY).toBe(true);
      expect(invoice.dueDate! >= invoice.invoiceDate!).toBe(true);
    }
  });

  it('stores amounts that agree with the invoice calculator', () => {
    for (const invoice of invoices) {
      const [item] = invoice.items!;
      const expected = calculateInvoiceAmounts({
        quantity: item!.quantity!,
        rate: item!.rate!,
        taxRate: invoice.taxRate!,
        discount: invoice.totalDiscount,
        totalPaid: invoice.totalPaid,
      });

      expect({
        subTotal: invoice.invoiceSubTotal,
        taxAmount: invoice.totalTax,
        totalAmount: invoice.totalAmount,
        balanceAmount: invoice.balanceAmount,
      }).toEqual({
        subTotal: expected.subTotal,
        taxAmount: expected.taxAmount,
        totalAmount: expected.totalAmount,
        balanceAmount: expected.balanceAmount,
      });
    }
  });

  it('pays Paid invoices in full, Drafts not at all, and some Pending ones in part', () => {
    const byStatus = (status: StoredInvoiceStatus) =>
      generated.filter((invoice) => invoice.status === status);

    for (const invoice of byStatus(StoredInvoiceStatus.Paid)) {
      expect(invoice.totalPaid).toBe(invoice.totalAmount);
      expect(invoice.balanceAmount).toBe('0.00');
    }
    for (const invoice of byStatus(StoredInvoiceStatus.Draft)) {
      expect(invoice.totalPaid).toBe('0.00');
    }
    const pending = byStatus(StoredInvoiceStatus.Pending);
    expect(pending.some((invoice) => invoice.totalPaid === '0.00')).toBe(true);
    expect(pending.some((invoice) => invoice.totalPaid !== '0.00')).toBe(true);
  });

  it('varies amounts, dates, currencies and customers', () => {
    const distinct = (pick: (invoice: (typeof generated)[number]) => unknown) =>
      new Set(generated.map(pick)).size;

    expect(distinct((invoice) => invoice.totalAmount)).toBeGreaterThan(20);
    expect(distinct((invoice) => invoice.invoiceDate)).toBeGreaterThan(20);
    expect(distinct((invoice) => invoice.dueDate)).toBeGreaterThan(20);
    expect(distinct((invoice) => invoice.currency)).toBeGreaterThanOrEqual(4);
    expect(distinct((invoice) => invoice.customerFullname)).toBeGreaterThan(8);
  });

  it('repeats customers, so a name search returns several invoices', () => {
    const forOlivia = generated.filter(
      (invoice) => invoice.customerFullname === 'Olivia Bennett',
    );

    expect(forOlivia.length).toBeGreaterThan(1);
  });

  it('produces the same data every time for the same day', () => {
    expect(buildSeedInvoices(TODAY, USER_ID)).toEqual(invoices);
  });

  it('moves the generated dates with the day it runs, but not the Appendix A record', () => {
    const later = buildSeedInvoices(addDays(TODAY, 10), USER_ID);

    expect(later[0]!.invoiceDate).toBe(invoices[0]!.invoiceDate);
    expect(later[1]!.invoiceDate).toBe(addDays(invoices[1]!.invoiceDate!, 10));
  });

  it('records the given user as creator of every invoice', () => {
    expect(invoices.every((invoice) => invoice.createdBy === USER_ID)).toBe(
      true,
    );
  });
});
