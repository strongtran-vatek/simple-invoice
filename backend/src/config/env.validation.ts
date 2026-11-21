// class-transformer's @Type reads decorator metadata, also when run outside Nest.
import 'reflect-metadata';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsTimeZone,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/**
 * Every environment variable the backend reads, with its validation rule.
 * The app refuses to start when one is missing or malformed.
 */
export class Environment {
  @IsString()
  @IsNotEmpty()
  DB_HOST: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT: number;

  @IsString()
  @IsNotEmpty()
  DB_USER: string;

  @IsString()
  @IsNotEmpty()
  DB_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  DB_NAME: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  BACKEND_PORT: number = 3000;

  /** HS256 signing key. Shorter keys are brute-forceable, so they are rejected. */
  @IsString()
  @MinLength(32)
  JWT_SECRET: string;

  /** Access token lifetime in seconds. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  JWT_EXPIRES_IN: number = 3600;

  /** IANA timezone that decides what "today" is when deriving Overdue. */
  @IsTimeZone()
  APP_TIMEZONE: string = 'UTC';

  /** Comma-separated list of origins allowed by CORS. */
  @IsString()
  @IsNotEmpty()
  FRONTEND_ORIGIN: string;
}

/**
 * Validates raw environment variables and applies defaults.
 * A variable set to an empty string counts as unset, so `FOO=` in a .env file
 * falls back to the default instead of failing as "not a number".
 */
export function validateEnvironment(raw: Record<string, unknown>): Environment {
  const defined = Object.fromEntries(
    Object.entries(raw).filter(([, value]) => value !== '' && value != null),
  );
  const environment = plainToInstance(Environment, defined, {
    exposeDefaultValues: true,
  });
  const errors = validateSync(environment);

  if (errors.length > 0) {
    const details = errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .map((message) => `  - ${message}`)
      .join('\n');
    throw new Error(
      `Invalid environment configuration. Copy .env.example to .env and fix:\n${details}`,
    );
  }

  return environment;
}
