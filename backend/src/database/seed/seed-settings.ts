import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, validateSync } from 'class-validator';

/** Environment variables read only by the seed script. */
export class SeedSettings {
  @IsEmail()
  SEED_USER_EMAIL: string;

  @IsString()
  @IsNotEmpty()
  SEED_USER_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  SEED_USER_FULLNAME: string;
}

export function validateSeedSettings(
  raw: Record<string, unknown>,
): SeedSettings {
  const settings = plainToInstance(SeedSettings, {
    SEED_USER_EMAIL: raw.SEED_USER_EMAIL,
    SEED_USER_PASSWORD: raw.SEED_USER_PASSWORD,
    SEED_USER_FULLNAME: raw.SEED_USER_FULLNAME,
  });
  const errors = validateSync(settings);

  if (errors.length > 0) {
    const details = errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .map((message) => `  - ${message}`)
      .join('\n');
    throw new Error(
      `Invalid seed configuration. Copy .env.example to .env and fix:\n${details}`,
    );
  }

  return settings;
}
