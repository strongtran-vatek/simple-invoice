/**
 * The currencies an invoice may be issued in, with the symbol shown beside
 * amounts. The backend derives the symbol; clients never send it.
 */
export const CURRENCY_SYMBOLS = {
  AUD: 'AU$',
  USD: 'US$',
  GBP: '£',
  EUR: '€',
  SGD: 'S$',
  VND: '₫',
} as const;

export type CurrencyCode = keyof typeof CURRENCY_SYMBOLS;

export const SUPPORTED_CURRENCIES = Object.keys(
  CURRENCY_SYMBOLS,
) as CurrencyCode[];
