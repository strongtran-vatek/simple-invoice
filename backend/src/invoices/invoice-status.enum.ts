/**
 * The statuses an invoice can be saved with.
 * Overdue is deliberately absent: it is derived at read time and never stored.
 */
export enum StoredInvoiceStatus {
  Draft = 'Draft',
  Pending = 'Pending',
  Paid = 'Paid',
}

/**
 * The effective status: what the API returns and filters by.
 * It is the stored status, or Overdue when the invoice is overdue.
 */
export enum InvoiceStatus {
  Draft = 'Draft',
  Pending = 'Pending',
  Paid = 'Paid',
  Overdue = 'Overdue',
}

/**
 * Derives the effective status of an invoice.
 *
 * An invoice is Overdue when it is not Paid and its due date is before today;
 * an invoice due today is not yet overdue. Dates are `YYYY-MM-DD` strings,
 * which compare correctly as text.
 */
export function deriveInvoiceStatus(
  storedStatus: StoredInvoiceStatus,
  dueDate: string,
  today: string,
): InvoiceStatus {
  if (storedStatus !== StoredInvoiceStatus.Paid && dueDate < today) {
    return InvoiceStatus.Overdue;
  }
  return InvoiceStatus[storedStatus];
}
