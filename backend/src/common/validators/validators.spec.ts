import { validateSync } from 'class-validator';
import { IsDateOnly, isDateOnly } from './is-date-only.js';
import { IsOnOrAfter } from './is-on-or-after.js';

describe('isDateOnly', () => {
  it.each(['2026-06-03', '2024-02-29', '1999-12-31'])('accepts %s', (value) => {
    expect(isDateOnly(value)).toBe(true);
  });

  it.each([
    ['a day that does not exist', '2026-02-30'],
    ['29 February in a non-leap year', '2026-02-29'],
    ['month 13', '2026-13-01'],
    ['a date with a time', '2026-06-03T00:00:00Z'],
    ['day/month/year order', '03/06/2026'],
    ['unpadded parts', '2026-6-3'],
    ['an empty string', ''],
    ['a number', 20260603],
    ['null', null],
  ])('rejects %s', (_description, value) => {
    expect(isDateOnly(value)).toBe(false);
  });
});

class Period {
  @IsDateOnly()
  invoiceDate: unknown;

  @IsDateOnly()
  @IsOnOrAfter('invoiceDate')
  dueDate: unknown;
}

function messagesFor(invoiceDate: unknown, dueDate: unknown): string[] {
  const period = Object.assign(new Period(), { invoiceDate, dueDate });
  return validateSync(period).flatMap((error) =>
    Object.values(error.constraints ?? {}),
  );
}

describe('IsOnOrAfter', () => {
  it('accepts a later date', () => {
    expect(messagesFor('2026-06-03', '2026-07-03')).toEqual([]);
  });

  it('accepts the same date', () => {
    expect(messagesFor('2026-06-03', '2026-06-03')).toEqual([]);
  });

  it('rejects an earlier date, naming both properties', () => {
    expect(messagesFor('2026-06-03', '2026-06-02')).toEqual([
      'dueDate must be on or after invoiceDate',
    ]);
  });

  it('reports only the format problem when a date is malformed', () => {
    expect(messagesFor('2026-06-03', 'soon')).toEqual([
      'dueDate must be a valid date in YYYY-MM-DD format',
    ]);
    expect(messagesFor('yesterday', '2026-06-02')).toEqual([
      'invoiceDate must be a valid date in YYYY-MM-DD format',
    ]);
  });
});
