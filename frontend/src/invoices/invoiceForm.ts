import { z } from 'zod'
import type { CreateInvoiceRequest } from '../api/invoices'
import { addDays, isDateOnly, todayLocal } from './dates'

/** The currencies the backend accepts. It derives the symbol itself. */
export const CURRENCIES = ['AUD', 'USD', 'GBP', 'EUR', 'SGD', 'VND'] as const

/**
 * Used only to preview amounts on the form. A saved invoice carries the
 * symbol the backend chose.
 */
export const CURRENCY_SYMBOLS: Record<(typeof CURRENCIES)[number], string> = {
  AUD: 'AU$',
  USD: 'US$',
  GBP: '£',
  EUR: '€',
  SGD: 'S$',
  VND: '₫',
}

export const DEFAULT_TAX_RATE = 10
/** A new invoice falls due this many days after its invoice date. */
export const DEFAULT_PAYMENT_TERM_DAYS = 30

const MAX_TAX_RATE = 100
const MAX_QUANTITY = 1_000_000
const MAX_RATE = 999_999_999.99
const MAX_AMOUNT = 999_999_999_999.99

const WHOLE_NUMBER = /^\d+$/
const UP_TO_TWO_DECIMALS = /^\d+(\.\d{1,2})?$/

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`)

const optionalText = (label: string, max: number) =>
  z.string().trim().max(max, `${label} must be at most ${max} characters`)

const requiredDate = (label: string) =>
  z
    .string()
    .min(1, `${label} is required`)
    .refine((value) => value === '' || isDateOnly(value), 'Enter a valid date')

/**
 * A number typed into a text box. It stays text until it is known to be
 * well-formed, so "12abc" and "1.999" are refused rather than rounded.
 */
const typedNumber = (
  required: string,
  format: RegExp,
  malformed: string,
  { min, max, label }: { min: number; max: number; label: string },
) =>
  z
    .string()
    .trim()
    .min(1, required)
    .refine((value) => value === '' || format.test(value), malformed)
    .transform(Number)
    .refine((value) => value >= min, malformed)
    .refine((value) => value <= max, `${label} must be at most ${max}`)

/**
 * The create-invoice form. The rules mirror the backend's `CreateInvoiceDto`,
 * so a mistake is reported beside its field without a round trip. The backend
 * checks everything again and remains the authority.
 */
export const invoiceFormSchema = z
  .object({
    invoiceNumber: requiredText('Invoice number', 50),
    invoiceReference: optionalText('Reference', 50),
    invoiceDate: requiredDate('Invoice date'),
    dueDate: requiredDate('Due date'),
    currency: z.enum(CURRENCIES, 'Choose a currency'),
    description: optionalText('Description', 500),

    customerName: requiredText('Customer name', 255),
    customerEmail: requiredText('Customer email', 255).pipe(
      z.email('Enter a valid email address'),
    ),
    customerMobile: optionalText('Mobile', 50),
    customerAddress: optionalText('Address', 500),

    itemName: requiredText('Item name', 255),
    quantity: typedNumber(
      'Quantity is required',
      WHOLE_NUMBER,
      'Quantity must be a whole number of 1 or more',
      { min: 1, max: MAX_QUANTITY, label: 'Quantity' },
    ),
    rate: typedNumber(
      'Rate is required',
      UP_TO_TWO_DECIMALS,
      'Rate must be a number greater than 0, with up to 2 decimal places',
      { min: 0.01, max: MAX_RATE, label: 'Rate' },
    ),
    tax: typedNumber(
      'Enter a tax rate, or 0 for no tax',
      UP_TO_TWO_DECIMALS,
      'Tax must be a number of 0 or more, with up to 2 decimal places',
      { min: 0, max: MAX_TAX_RATE, label: 'Tax' },
    ),
    // Optional: an empty box means no discount.
    discount: z
      .string()
      .transform((value) => (value.trim() === '' ? '0' : value))
      .pipe(
        typedNumber(
          'Discount is required',
          UP_TO_TWO_DECIMALS,
          'Discount must be a number of 0 or more, with up to 2 decimal places',
          { min: 0, max: MAX_AMOUNT, label: 'Discount' },
        ),
      ),
  })
  .refine(
    (form) =>
      !isDateOnly(form.invoiceDate) ||
      !isDateOnly(form.dueDate) ||
      form.dueDate >= form.invoiceDate,
    {
      path: ['dueDate'],
      message: 'Due date must be on or after the invoice date',
    },
  )

/** What the form holds while it is being edited: every field is text. */
export type InvoiceFormValues = z.input<typeof invoiceFormSchema>
/** The form once validated: trimmed text and real numbers. */
export type ValidInvoiceForm = z.output<typeof invoiceFormSchema>

/** A blank form with the agreed defaults filled in. */
export function defaultInvoiceForm(today = todayLocal()): InvoiceFormValues {
  return {
    invoiceNumber: '',
    invoiceReference: '',
    invoiceDate: today,
    dueDate: addDays(today, DEFAULT_PAYMENT_TERM_DAYS),
    currency: 'AUD',
    description: '',
    customerName: '',
    customerEmail: '',
    customerMobile: '',
    customerAddress: '',
    itemName: '',
    quantity: '1',
    rate: '',
    tax: String(DEFAULT_TAX_RATE),
    discount: '0',
  }
}

/** Shapes a validated form as the body of `POST /invoices`. */
export function toCreateInvoiceRequest(
  form: ValidInvoiceForm,
): CreateInvoiceRequest {
  return {
    invoiceNumber: form.invoiceNumber,
    // An optional field left blank is left out of the request.
    invoiceReference: form.invoiceReference || undefined,
    invoiceDate: form.invoiceDate,
    dueDate: form.dueDate,
    currency: form.currency,
    description: form.description || undefined,
    customer: {
      fullname: form.customerName,
      email: form.customerEmail,
      mobileNumber: form.customerMobile || undefined,
      address: form.customerAddress || undefined,
    },
    items: [{ name: form.itemName, quantity: form.quantity, rate: form.rate }],
    tax: form.tax,
    discount: form.discount,
  }
}
