import { registerDecorator, type ValidationOptions } from 'class-validator';

/**
 * Validates that a property is an array holding exactly one element. One rule
 * with one message, where separate "is an array", "at least one" and "at most
 * one" rules would report a missing value three times.
 */
export function HasExactlyOneElement(
  options?: ValidationOptions,
): PropertyDecorator {
  return (target, propertyName) => {
    registerDecorator({
      name: 'hasExactlyOneElement',
      target: target.constructor,
      propertyName: String(propertyName),
      options: {
        message: '$property must contain exactly one element',
        ...options,
      },
      validator: {
        validate: (value: unknown) =>
          Array.isArray(value) && value.length === 1,
      },
    });
  };
}
