const pad = (value: number) => String(value).padStart(2, '0')

/** Today's date where the user is, as `YYYY-MM-DD`. */
export function todayLocal(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** The `YYYY-MM-DD` date a number of days after another. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  // Worked out in UTC, where no day is ever 23 or 25 hours long.
  const result = new Date(Date.UTC(year, month - 1, day + days))
  return result.toISOString().slice(0, 10)
}

/** True for a real calendar date written as `YYYY-MM-DD`. */
export function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  // An impossible date such as 30 February rolls over to another day.
  return addDays(value, 0) === value
}
