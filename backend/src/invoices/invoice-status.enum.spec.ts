import {
  deriveInvoiceStatus,
  InvoiceStatus,
  StoredInvoiceStatus,
} from './invoice-status.enum.js';

const TODAY = '2026-06-15';
const YESTERDAY = '2026-06-14';
const TOMORROW = '2026-06-16';

describe('deriveInvoiceStatus', () => {
  it('reports an unpaid invoice past its due date as Overdue', () => {
    expect(
      deriveInvoiceStatus(StoredInvoiceStatus.Pending, YESTERDAY, TODAY),
    ).toBe(InvoiceStatus.Overdue);
  });

  it('applies to Draft invoices as well as Pending ones', () => {
    expect(
      deriveInvoiceStatus(StoredInvoiceStatus.Draft, YESTERDAY, TODAY),
    ).toBe(InvoiceStatus.Overdue);
  });

  it('never reports a Paid invoice as Overdue', () => {
    expect(
      deriveInvoiceStatus(StoredInvoiceStatus.Paid, YESTERDAY, TODAY),
    ).toBe(InvoiceStatus.Paid);
    expect(
      deriveInvoiceStatus(StoredInvoiceStatus.Paid, '2020-01-01', TODAY),
    ).toBe(InvoiceStatus.Paid);
  });

  it('does not treat an invoice due today as overdue', () => {
    expect(deriveInvoiceStatus(StoredInvoiceStatus.Pending, TODAY, TODAY)).toBe(
      InvoiceStatus.Pending,
    );
    expect(deriveInvoiceStatus(StoredInvoiceStatus.Draft, TODAY, TODAY)).toBe(
      InvoiceStatus.Draft,
    );
  });

  it('returns the stored status while the due date is in the future', () => {
    expect(
      deriveInvoiceStatus(StoredInvoiceStatus.Draft, TOMORROW, TODAY),
    ).toBe(InvoiceStatus.Draft);
    expect(
      deriveInvoiceStatus(StoredInvoiceStatus.Pending, TOMORROW, TODAY),
    ).toBe(InvoiceStatus.Pending);
    expect(deriveInvoiceStatus(StoredInvoiceStatus.Paid, TOMORROW, TODAY)).toBe(
      InvoiceStatus.Paid,
    );
  });

  it('compares dates across month and year boundaries', () => {
    expect(
      deriveInvoiceStatus(
        StoredInvoiceStatus.Pending,
        '2026-05-31',
        '2026-06-01',
      ),
    ).toBe(InvoiceStatus.Overdue);
    expect(
      deriveInvoiceStatus(
        StoredInvoiceStatus.Pending,
        '2025-12-31',
        '2026-01-01',
      ),
    ).toBe(InvoiceStatus.Overdue);
    expect(
      deriveInvoiceStatus(
        StoredInvoiceStatus.Pending,
        '2026-10-01',
        '2026-09-30',
      ),
    ).toBe(InvoiceStatus.Pending);
  });
});
