import type { ConfigService } from '@nestjs/config';
import type { Environment } from '../config/env.validation.js';
import { Clock, dateInTimeZone } from './clock.js';

describe('dateInTimeZone', () => {
  // 15 June 2026, 20:30 UTC.
  const instant = new Date('2026-06-15T20:30:00.000Z');

  it('formats the date as YYYY-MM-DD', () => {
    expect(dateInTimeZone(instant, 'UTC')).toBe('2026-06-15');
  });

  it('is already the next day east of UTC', () => {
    expect(dateInTimeZone(instant, 'Asia/Singapore')).toBe('2026-06-16');
    expect(dateInTimeZone(instant, 'Australia/Sydney')).toBe('2026-06-16');
  });

  it('is still the same day west of UTC', () => {
    expect(dateInTimeZone(instant, 'America/Los_Angeles')).toBe('2026-06-15');
  });

  it('pads single-digit months and days', () => {
    expect(dateInTimeZone(new Date('2026-01-05T12:00:00.000Z'), 'UTC')).toBe(
      '2026-01-05',
    );
  });
});

describe('Clock', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns today in the configured timezone', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T20:30:00.000Z'));
    const clockIn = (timeZone: string) =>
      new Clock({ get: () => timeZone } as unknown as ConfigService<
        Environment,
        true
      >);

    expect(clockIn('UTC').today()).toBe('2026-06-15');
    expect(clockIn('Asia/Ho_Chi_Minh').today()).toBe('2026-06-16');
  });
});
