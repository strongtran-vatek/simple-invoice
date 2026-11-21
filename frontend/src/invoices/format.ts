const amountFormat = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Formats an amount with its currency symbol, e.g. `AU$2,180.00`. */
export function formatMoney(amount: number, currencySymbol: string): string {
  const sign = amount < 0 ? '-' : ''
  return `${sign}${currencySymbol}${amountFormat.format(Math.abs(amount))}`
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/**
 * Formats a `YYYY-MM-DD` date as `03 Jun 2026`.
 *
 * The same in every browser locale, so day and month cannot be confused. The
 * string is split rather than parsed into a Date, which would shift the day
 * in timezones behind UTC.
 */
export function formatDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  const month = match ? MONTHS[Number(match[2]) - 1] : undefined
  if (!match || !month) {
    return date
  }
  return `${match[3]} ${month} ${match[1]}`
}
