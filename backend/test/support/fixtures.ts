import type { DataSource } from 'typeorm';
import { calculateInvoiceAmounts } from '../../src/invoices/invoice-calculator.js';
import { StoredInvoiceStatus } from '../../src/invoices/invoice-status.enum.js';
import { Invoice } from '../../src/invoices/invoice.entity.js';

export interface InvoiceFixture {
  invoiceNumber: string;
  customerFullname?: string;
  invoiceDate?: string;
  dueDate?: string;
  status?: StoredInvoiceStatus;
  currency?: string;
  currencySymbol?: string;
  quantity?: number;
  rate?: string;
  taxRate?: string;
  discount?: string;
  totalPaid?: string;
  itemName?: string;
  invoiceReference?: string;
  description?: string;
  customerEmail?: string;
  customerMobile?: string;
  customerAddress?: string;
}

/** Inserts an invoice directly, with amounts worked out by the real calculator. */
export async function insertInvoice(
  dataSource: DataSource,
  createdBy: string,
  fixture: InvoiceFixture,
): Promise<Invoice> {
  const quantity = fixture.quantity ?? 1;
  const rate = fixture.rate ?? '100.00';
  const taxRate = fixture.taxRate ?? '10.00';
  const amounts = calculateInvoiceAmounts({
    quantity,
    rate,
    taxRate,
    discount: fixture.discount,
    totalPaid: fixture.totalPaid,
  });

  return dataSource.getRepository(Invoice).save({
    invoiceNumber: fixture.invoiceNumber,
    invoiceDate: fixture.invoiceDate ?? '2026-06-01',
    dueDate: fixture.dueDate ?? '2026-07-01',
    currency: fixture.currency ?? 'AUD',
    currencySymbol: fixture.currencySymbol ?? 'AU$',
    status: fixture.status ?? StoredInvoiceStatus.Draft,
    taxRate,
    invoiceSubTotal: amounts.subTotal,
    totalTax: amounts.taxAmount,
    totalDiscount: amounts.discount,
    totalAmount: amounts.totalAmount,
    totalPaid: amounts.totalPaid,
    balanceAmount: amounts.balanceAmount,
    customerFullname: fixture.customerFullname ?? 'Test Customer',
    customerEmail: fixture.customerEmail ?? 'customer@example.com',
    customerMobile: fixture.customerMobile ?? null,
    customerAddress: fixture.customerAddress ?? null,
    invoiceReference: fixture.invoiceReference ?? null,
    description: fixture.description ?? null,
    createdBy,
    items: [{ name: fixture.itemName ?? 'Test item', quantity, rate }],
  });
}
