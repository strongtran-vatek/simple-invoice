import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../config/env.validation.js';

/** Formats an instant as the calendar date (`YYYY-MM-DD`) it falls on in a timezone. */
export function dateInTimeZone(instant: Date, timeZone: string): string {
  // The en-CA locale writes dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/**
 * The application's source of "today". Injected rather than read from
 * `new Date()` directly so tests can pin the date.
 */
@Injectable()
export class Clock {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  /** Today's calendar date, `YYYY-MM-DD`, in the configured `APP_TIMEZONE`. */
  today(): string {
    return dateInTimeZone(
      new Date(),
      this.config.get('APP_TIMEZONE', { infer: true }),
    );
  }
}
