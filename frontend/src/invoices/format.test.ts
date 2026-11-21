import { formatDate, formatMoney } from './format'

describe('formatMoney', () => {
  it('puts the currency symbol first and separates thousands', () => {
    expect(formatMoney(2180, 'AU$')).toBe('AU$2,180.00')
    expect(formatMoney(1234567.5, 'US$')).toBe('US$1,234,567.50')
  })

  it('always shows two decimals', () => {
    expect(formatMoney(5, '£')).toBe('£5.00')
    expect(formatMoney(9.9, '€')).toBe('€9.90')
    expect(formatMoney(0, 'S$')).toBe('S$0.00')
  })

  it('puts the minus sign before the symbol', () => {
    expect(formatMoney(-20, 'AU$')).toBe('-AU$20.00')
  })
})

describe('formatDate', () => {
  it('writes day, short month and year', () => {
    expect(formatDate('2026-06-03')).toBe('03 Jun 2026')
    expect(formatDate('2026-12-31')).toBe('31 Dec 2026')
    expect(formatDate('2026-01-01')).toBe('01 Jan 2026')
  })

  it('does not shift the day in any timezone', () => {
    // Parsing through Date would give 31 Dec 2025 in timezones behind UTC.
    expect(formatDate('2026-01-01')).toContain('2026')
  })

  it('returns anything it cannot read unchanged', () => {
    expect(formatDate('not a date')).toBe('not a date')
    expect(formatDate('2026-13-01')).toBe('2026-13-01')
    expect(formatDate('')).toBe('')
  })
})
