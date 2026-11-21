import { Decimal } from 'decimal.js';

export interface InvoiceAmountsInput {
  quantity: number;
  /** Price per unit. */
  rate: Decimal.Value;
  /** Tax as a percentage of the subtotal, e.g. 10 for 10%. */
  taxRate: Decimal.Value;
  /** An absolute amount in the invoice currency, not a percentage. */
  discount?: Decimal.Value;
  totalPaid?: Decimal.Value;
}

/** Amounts as fixed two-decimal strings, ready for `numeric(14,2)` columns. */
export interface InvoiceAmounts {
  subTotal: string;
  taxAmount: string;
  discount: string;
  totalAmount: string;
  totalPaid: string;
  balanceAmount: string;
}

const CENTS = 2;

/**
 * Computes every amount on an invoice from its line item, tax rate and discount.
 *
 *   subTotal      = quantity × rate
 *   taxAmount     = subTotal × taxRate / 100   (rounded half-up to the cent)
 *   totalAmount   = subTotal + taxAmount − discount
 *   balanceAmount = totalAmount − totalPaid
 *
 * Tax is charged on the undiscounted subtotal. Arithmetic uses decimals, never
 * binary floats, so 0.1 + 0.2 style errors cannot occur. The total may come
 * out negative when the discount is too large; rejecting that is the caller's job.
 */
export function calculateInvoiceAmounts(
  input: InvoiceAmountsInput,
): InvoiceAmounts {
  const subTotal = new Decimal(input.rate).times(input.quantity);
  const taxAmount = subTotal
    .times(input.taxRate)
    .dividedBy(100)
    .toDecimalPlaces(CENTS, Decimal.ROUND_HALF_UP);
  const discount = new Decimal(input.discount ?? 0);
  const totalAmount = subTotal.plus(taxAmount).minus(discount);
  const totalPaid = new Decimal(input.totalPaid ?? 0);

  return {
    subTotal: subTotal.toFixed(CENTS),
    taxAmount: taxAmount.toFixed(CENTS),
    discount: discount.toFixed(CENTS),
    totalAmount: totalAmount.toFixed(CENTS),
    totalPaid: totalPaid.toFixed(CENTS),
    balanceAmount: totalAmount.minus(totalPaid).toFixed(CENTS),
  };
}
