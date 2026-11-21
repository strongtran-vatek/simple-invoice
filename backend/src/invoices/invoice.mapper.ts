import { Decimal } from 'decimal.js';
import type { InvoiceDetailDto } from './dto/invoice-detail.dto.js';
import type { InvoiceSummaryDto } from './dto/invoice-summary.dto.js';
import { deriveInvoiceStatus } from './invoice-status.enum.js';
import type { Invoice } from './invoice.entity.js';

/** The fields a list row and the full detail have in common. */
function sharedFields(invoice: Invoice, today: string) {
  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    currencySymbol: invoice.currencySymbol,
    // numeric(14,2) fits a JSON number without losing precision.
    totalAmount: Number(invoice.totalAmount),
    // The stored status itself is never exposed.
    status: deriveInvoiceStatus(invoice.status, invoice.dueDate, today),
  };
}

/**
 * Converts a stored invoice into a list row. `today` decides whether the
 * invoice is Overdue.
 */
export function toInvoiceSummary(
  invoice: Invoice,
  today: string,
): InvoiceSummaryDto {
  return {
    ...sharedFields(invoice, today),
    customer: { fullname: invoice.customerFullname },
  };
}

/**
 * Converts a stored invoice, loaded with its line items, into the full detail.
 * Invoice totals are reported as stored; only each line's amount
 * (quantity × rate) is worked out here.
 */
export function toInvoiceDetail(
  invoice: Invoice,
  today: string,
): InvoiceDetailDto {
  return {
    ...sharedFields(invoice, today),
    invoiceReference: invoice.invoiceReference,
    description: invoice.description,
    taxRate: Number(invoice.taxRate),
    invoiceSubTotal: Number(invoice.invoiceSubTotal),
    totalTax: Number(invoice.totalTax),
    totalDiscount: Number(invoice.totalDiscount),
    totalPaid: Number(invoice.totalPaid),
    balanceAmount: Number(invoice.balanceAmount),
    customer: {
      fullname: invoice.customerFullname,
      email: invoice.customerEmail,
      mobileNumber: invoice.customerMobile,
      address: invoice.customerAddress,
    },
    items: invoice.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      rate: Number(item.rate),
      amount: new Decimal(item.rate).times(item.quantity).toNumber(),
    })),
    createdAt: invoice.createdAt.toISOString(),
    createdBy: invoice.createdBy,
  };
}
