import { registerDecorator, type ValidationOptions } from 'class-validator';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar date written as `YYYY-MM-DD` (so not 2026-02-30). */
export function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const match = DATE_ONLY.exec(value);
  if (!match) {
    return false;
  }
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  // An impossible date rolls over, e.g. 30 February becomes 2 March.
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Validates that a property is a calendar date in `YYYY-MM-DD` format. */
export function IsDateOnly(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyName) => {
    registerDecorator({
      name: 'isDateOnly',
      target: target.constructor,
      propertyName: String(propertyName),
      options: {
        message: '$property must be a valid date in YYYY-MM-DD format',
        ...options,
      },
      validator: { validate: isDateOnly },
    });
  };
}
