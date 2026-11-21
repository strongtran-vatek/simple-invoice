import { addDays, isDateOnly, todayLocal } from './dates'

describe('todayLocal', () => {
  it('formats the local date as YYYY-MM-DD, padding month and day', () => {
    expect(todayLocal(new Date(2026, 0, 5, 10))).toBe('2026-01-05')
    expect(todayLocal(new Date(2026, 10, 21, 10))).toBe('2026-11-21')
  })

  it('uses the local calendar day, even just before and after midnight', () => {
    expect(todayLocal(new Date(2026, 5, 3, 0, 0, 1))).toBe('2026-06-03')
    expect(todayLocal(new Date(2026, 5, 3, 23, 59, 59))).toBe('2026-06-03')
  })
})

describe('addDays', () => {
  it('adds days within a month', () => {
    expect(addDays('2026-06-03', 7)).toBe('2026-06-10')
  })

  it('rolls over months and years', () => {
    expect(addDays('2026-06-03', 30)).toBe('2026-07-03')
    expect(addDays('2026-12-15', 30)).toBe('2027-01-14')
  })

  it('knows about leap years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })

  it('returns the same date for zero days', () => {
    expect(addDays('2026-06-03', 0)).toBe('2026-06-03')
  })
})

describe('isDateOnly', () => {
  it.each(['2026-06-03', '2028-02-29', '1999-12-31'])('accepts %s', (date) => {
    expect(isDateOnly(date)).toBe(true)
  })

  it.each([
    ['a day that does not exist', '2026-02-30'],
    ['month 13', '2026-13-01'],
    ['a six-digit year', '202606-03-01'],
    ['day/month/year order', '03/06/2026'],
    ['an empty string', ''],
  ])('rejects %s', (_description, date) => {
    expect(isDateOnly(date)).toBe(false)
  })
})
