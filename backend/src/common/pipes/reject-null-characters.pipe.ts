import {
  type ArgumentMetadata,
  BadRequestException,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';

const NULL_CHARACTER = '\u0000';

/**
 * Lists the paths of every string in a value that contains a null character,
 * e.g. `customer.fullname` or `items.0.name`.
 */
export function findNullCharacters(value: unknown, path = ''): string[] {
  if (typeof value === 'string') {
    return value.includes(NULL_CHARACTER) ? [path || 'value'] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findNullCharacters(item, path ? `${path}.${index}` : String(index)),
    );
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, item]) =>
      findNullCharacters(item, path ? `${path}.${key}` : key),
    );
  }
  return [];
}

/**
 * Refuses request text that contains a null character (U+0000).
 *
 * PostgreSQL cannot store that character in a text column or accept it in a
 * query parameter, so letting it through turns a malformed request into a
 * database error and a 500. No legitimate invoice text contains it.
 */
@Injectable()
export class RejectNullCharactersPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    // Values injected by custom decorators come from the server, not the client.
    if (metadata.type === 'custom') {
      return value;
    }
    const paths = findNullCharacters(value, metadata.data ?? '');
    if (paths.length > 0) {
      throw new BadRequestException(
        paths.map((path) => `${path} must not contain a null character`),
      );
    }
    return value;
  }
}
