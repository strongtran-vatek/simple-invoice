import type { InvoiceSummaryDto } from './dto/invoice-summary.dto.js';
import { deriveInvoiceStatus } from './invoice-status.enum.js';
import type { Invoice } from './invoice.entity.js';

/**
 * Converts a stored invoice into a list row. `today` decides whether the
 * invoice is Overdue; the stored status itself is never exposed.
 */
export function toInvoiceSummary(
  invoice: Invoice,
  today: string,
): InvoiceSummaryDto {
  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    currencySymbol: invoice.currencySymbol,
    // numeric(14,2) fits a JSON number without losing precision.
    totalAmount: Number(invoice.totalAmount),
    status: deriveInvoiceStatus(invoice.status, invoice.dueDate, today),
    customer: { fullname: invoice.customerFullname },
  };
}
