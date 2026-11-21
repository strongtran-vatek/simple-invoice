/**
 * The statuses an invoice can be saved with.
 * Overdue is deliberately absent: it is derived at read time and never stored.
 */
export enum StoredInvoiceStatus {
  Draft = 'Draft',
  Pending = 'Pending',
  Paid = 'Paid',
}
