import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';
import { isDateOnly } from './is-date-only.js';

/**
 * Validates that a `YYYY-MM-DD` date is on or after another date property of
 * the same object. Passes when either date is absent or malformed, leaving
 * that to the properties' own rules so one mistake yields one message.
 */
export function IsOnOrAfter(
  otherProperty: string,
  options?: ValidationOptions,
): PropertyDecorator {
  return (target, propertyName) => {
    registerDecorator({
      name: 'isOnOrAfter',
      target: target.constructor,
      propertyName: String(propertyName),
      constraints: [otherProperty],
      options: {
        message: `$property must be on or after ${otherProperty}`,
        ...options,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const other = (args.object as Record<string, unknown>)[otherProperty];
          if (!isDateOnly(value) || !isDateOnly(other)) {
            return true;
          }
          // ISO dates compare correctly as text.
          return value >= other;
        },
      },
    });
  };
}
