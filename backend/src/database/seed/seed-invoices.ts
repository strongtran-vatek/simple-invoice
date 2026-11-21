import { Decimal } from 'decimal.js';
import type { DataSource, DeepPartial } from 'typeorm';
import {
  CURRENCY_SYMBOLS,
  type CurrencyCode,
} from '../../common/currencies.js';
import { calculateInvoiceAmounts } from '../../invoices/invoice-calculator.js';
import { StoredInvoiceStatus } from '../../invoices/invoice-status.enum.js';
import { Invoice } from '../../invoices/invoice.entity.js';

/** How many invoices are generated in addition to the Appendix A record. */
export const GENERATED_INVOICE_COUNT = 40;

const { Draft, Pending, Paid } = StoredInvoiceStatus;

// Each list is cycled by the invoice's index, so the data is the same on every
// run and still varied. Overdue is never listed: it is derived from the dates.
const STATUSES = [
  Draft,
  Pending,
  Pending,
  Paid,
  Pending,
  Draft,
  Paid,
  Pending,
  Paid,
  Pending,
];
const PAYMENT_TERMS_DAYS = [7, 14, 30, 45, 60];
const TAX_RATES = [10, 10, 10, 0, 5, 8, 10, 20];
const CURRENCIES: CurrencyCode[] = [
  'AUD',
  'AUD',
  'USD',
  'AUD',
  'GBP',
  'SGD',
  'AUD',
  'EUR',
];

const CUSTOMERS = [
  {
    fullname: 'Olivia Bennett',
    email: 'olivia.bennett@example.com',
    mobile: '0412345678',
    address: 'Sydney',
  },
  {
    fullname: 'Liam Nguyen',
    email: 'liam.nguyen@example.com',
    mobile: '0987654321',
    address: 'Ho Chi Minh City',
  },
  {
    fullname: 'Amelia Tan',
    email: 'amelia.tan@example.com',
    mobile: null,
    address: 'Singapore',
  },
  {
    fullname: 'Noah Williams',
    email: 'noah.williams@example.com',
    mobile: '0400111222',
    address: null,
  },
  {
    fullname: 'Isla Thompson',
    email: 'isla.thompson@example.com',
    mobile: null,
    address: 'Melbourne',
  },
  {
    fullname: 'Ethan Patel',
    email: 'ethan.patel@example.com',
    mobile: '07700900123',
    address: 'London',
  },
  {
    fullname: 'Mia Rossi',
    email: 'mia.rossi@example.com',
    mobile: null,
    address: 'Milan',
  },
  {
    fullname: 'Lucas Martin',
    email: 'lucas.martin@example.com',
    mobile: '0611223344',
    address: 'Paris',
  },
  {
    fullname: 'Bennett & Co Trading',
    email: 'accounts@bennettco.example.com',
    mobile: '0299990000',
    address: 'Brisbane',
  },
  {
    fullname: 'Sophie Tran',
    email: 'sophie.tran@example.com',
    mobile: '0909123456',
    address: 'Hanoi',
  },
  {
    fullname: 'Harbour Cycles Pty Ltd',
    email: 'billing@harbourcycles.example.com',
    mobile: null,
    address: 'Perth',
  },
  {
    fullname: 'Oliver Chen',
    email: 'oliver.chen@example.com',
    mobile: '91234567',
    address: 'Singapore',
  },
];

const ITEMS = [
  { name: 'Honda RC150', rate: '1000.00' },
  { name: 'Annual servicing plan', rate: '420.00' },
  { name: 'Carbon road helmet', rate: '249.95' },
  { name: 'Brake pad set', rate: '35.50' },
  { name: 'Consulting hour', rate: '185.00' },
  { name: 'Yamaha Exciter 155', rate: '2150.00' },
  { name: 'Chain and sprocket kit', rate: '89.90' },
  { name: 'Riding jacket', rate: '310.25' },
  { name: 'Tyre fitting', rate: '48.00' },
  { name: 'Extended warranty', rate: '599.99' },
];

/** Adds days to a `YYYY-MM-DD` date. Negative values go back in time. */
export function addDays(date: string, days: number): string {
  const result = new Date(`${date}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

/** The single record given in Appendix A of the specification. */
function appendixInvoice(createdBy: string): DeepPartial<Invoice> {
  return {
    id: '099ca7da-a290-40fa-93b9-1c43ae7bb887',
    invoiceNumber: 'IV1780488206995',
    invoiceReference: '#5721662',
    invoiceDate: '2026-06-03',
    dueDate: '2026-07-03',
    currency: 'AUD',
    currencySymbol: CURRENCY_SYMBOLS.AUD,
    description: 'Invoice is issued to Kanglee',
    // The appendix lists this record as Overdue, which is never stored. It is
    // kept as Pending and becomes Overdue on its own once the due date passes.
    status: Pending,
    taxRate: '10.00',
    invoiceSubTotal: '2000.00',
    totalTax: '200.00',
    totalDiscount: '20.00',
    totalAmount: '2180.00',
    totalPaid: '1451.34',
    balanceAmount: '728.66',
    customerFullname: 'Paul',
    customerEmail: 'paul@101digital.io',
    customerMobile: '947717364111',
    customerAddress: 'Singapore',
    createdAt: new Date('2026-06-03T12:03:26.995Z'),
    createdBy,
    items: [
      {
        id: 'b1c2d3e4-0000-0000-0000-000000000001',
        name: 'Honda RC150',
        quantity: 2,
        rate: '1000.00',
      },
    ],
  };
}

function generatedInvoice(
  index: number,
  today: string,
  createdBy: string,
): DeepPartial<Invoice> {
  const status = STATUSES[index % STATUSES.length];
  const customer = CUSTOMERS[index % CUSTOMERS.length];
  const item = ITEMS[(index * 3) % ITEMS.length];
  const currency = CURRENCIES[index % CURRENCIES.length];
  const quantity = 1 + ((index * 5) % 12);
  // The multipliers and offsets below keep the cycles from lining up, so that
  // for example a currency does not always carry the same tax rate.
  const taxRate = TAX_RATES[(index * 3) % TAX_RATES.length];

  // Dates are relative to the day the seed runs, so some invoices are always
  // past due and some are not. Paid invoices reach back five months; unpaid
  // ones are recent, which keeps a fair share of them inside their terms.
  const ageInDays = status === Paid ? (index * 37) % 150 : (index * 13) % 50;
  const invoiceDate = addDays(today, -ageInDays);
  const dueDate = addDays(
    invoiceDate,
    PAYMENT_TERMS_DAYS[
      (index + Math.floor(index / 5)) % PAYMENT_TERMS_DAYS.length
    ],
  );

  const unpaid = calculateInvoiceAmounts({
    quantity,
    rate: item.rate,
    taxRate,
    // Every third invoice carries a discount of 5% of its subtotal.
    discount:
      index % 3 === 0
        ? new Decimal(item.rate).times(quantity).times('0.05').toFixed(2)
        : 0,
  });
  const amounts = calculateInvoiceAmounts({
    quantity,
    rate: item.rate,
    taxRate,
    discount: unpaid.discount,
    totalPaid: paidSoFar(status, index, unpaid.totalAmount),
  });

  return {
    invoiceNumber: `INV-${String(index + 1).padStart(4, '0')}`,
    invoiceReference: index % 2 === 0 ? `PO-${1000 + index}` : null,
    invoiceDate,
    dueDate,
    currency,
    currencySymbol: CURRENCY_SYMBOLS[currency],
    description:
      index % 4 === 0 ? null : `${item.name} for ${customer.fullname}`,
    status,
    taxRate: taxRate.toFixed(2),
    invoiceSubTotal: amounts.subTotal,
    totalTax: amounts.taxAmount,
    totalDiscount: amounts.discount,
    totalAmount: amounts.totalAmount,
    totalPaid: amounts.totalPaid,
    balanceAmount: amounts.balanceAmount,
    customerFullname: customer.fullname,
    customerEmail: customer.email,
    customerMobile: customer.mobile,
    customerAddress: customer.address,
    createdAt: new Date(`${invoiceDate}T09:00:00.000Z`),
    createdBy,
    items: [{ name: item.name, quantity, rate: item.rate }],
  };
}

/** Paid invoices are paid in full, some Pending ones in part, Drafts not at all. */
function paidSoFar(
  status: StoredInvoiceStatus,
  index: number,
  totalAmount: string,
): string {
  if (status === Paid) {
    return totalAmount;
  }
  if (status === Pending && index % 4 === 1) {
    return new Decimal(totalAmount).dividedBy(2).toFixed(2);
  }
  return '0.00';
}

/**
 * The full seed data set: the Appendix A record plus generated invoices.
 * A pure function of its arguments, so the same day always yields the same data.
 */
export function buildSeedInvoices(
  today: string,
  createdBy: string,
): DeepPartial<Invoice>[] {
  return [
    appendixInvoice(createdBy),
    ...Array.from({ length: GENERATED_INVOICE_COUNT }, (_, index) =>
      generatedInvoice(index, today, createdBy),
    ),
  ];
}

export interface SeedInvoicesOptions {
  /** Id of the user recorded as the creator of every seeded invoice. */
  createdBy: string;
  /** The reference date, `YYYY-MM-DD`, that generated dates count back from. */
  today: string;
  /** Delete all existing invoices first. */
  reset?: boolean;
}

/**
 * Inserts the seed invoices and returns how many were written. Does nothing
 * when invoices already exist, unless `reset` is set, so re-running the seed
 * never duplicates data or discards invoices created through the app.
 */
export async function seedInvoices(
  dataSource: DataSource,
  options: SeedInvoicesOptions,
): Promise<number> {
  const invoices = dataSource.getRepository(Invoice);

  if (options.reset) {
    // Line items go with their invoices (ON DELETE CASCADE).
    await invoices.createQueryBuilder().delete().execute();
  } else if ((await invoices.count()) > 0) {
    return 0;
  }

  const seeded = await invoices.save(
    buildSeedInvoices(options.today, options.createdBy),
  );
  return seeded.length;
}
