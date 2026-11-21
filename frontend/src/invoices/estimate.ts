/** The amounts an invoice would have, worked out in the browser for preview only. */
export interface InvoiceEstimate {
  subTotal: number
  tax: number
  discount: number
  /** Negative when the discount is larger than the subtotal plus tax. */
  total: number
}

/** What has been typed into the form's number boxes so far. */
export interface EstimateInput {
  quantity: string
  rate: string
  tax: string
  discount: string
}

const WHOLE_NUMBER = /^\d+$/
const UP_TO_TWO_DECIMALS = /^(\d+)(?:\.(\d{1,2}))?$/

/** "19.9" becomes 1990n: the value in hundredths, with no rounding error. */
function toHundredths(text: string): bigint | null {
  const match = UP_TO_TWO_DECIMALS.exec(text.trim())
  if (!match) {
    return null
  }
  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'))
}

const fromHundredths = (value: bigint) => Number(value) / 100

/**
 * Previews an invoice's amounts while the form is being filled in, or returns
 * null while the numbers are incomplete or malformed.
 *
 * This is an estimate for the user's convenience. The backend calculates the
 * amounts that are stored (`invoice-calculator.ts`) and this function follows
 * the same rules: tax on the undiscounted subtotal, rounded half-up to the
 * cent. Whole-number arithmetic in cents keeps it free of floating-point error.
 */
export function estimateInvoiceAmounts(
  input: EstimateInput,
): InvoiceEstimate | null {
  const quantity = input.quantity.trim()
  const rate = toHundredths(input.rate)
  // Tax is a percentage with two decimals, so in hundredths of a percent.
  const taxRate = toHundredths(input.tax)
  // An empty discount means none.
  const discount =
    input.discount.trim() === '' ? 0n : toHundredths(input.discount)

  if (
    !WHOLE_NUMBER.test(quantity) ||
    rate === null ||
    taxRate === null ||
    discount === null
  ) {
    return null
  }

  const subTotal = BigInt(quantity) * rate
  // Dividing by 10,000 undoes the two scalings; adding half first rounds half-up.
  const tax = (subTotal * taxRate + 5000n) / 10000n

  return {
    subTotal: fromHundredths(subTotal),
    tax: fromHundredths(tax),
    discount: fromHundredths(discount),
    total: fromHundredths(subTotal + tax - discount),
  }
}
