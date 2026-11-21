import { hash } from 'bcryptjs';
import type { DataSource } from 'typeorm';
import { DEFAULT_BCRYPT_ROUNDS } from '../../auth/password.service.js';
import { User } from '../../users/user.entity.js';
import { normalizeEmail } from '../../users/users.service.js';
import type { SeedSettings } from './seed-settings.js';

/**
 * Creates the default reviewer account, or resets its password and name if it
 * already exists. Safe to run repeatedly: the documented credentials always work.
 */
export async function seedDefaultUser(
  dataSource: DataSource,
  settings: SeedSettings,
  bcryptRounds: number = DEFAULT_BCRYPT_ROUNDS,
): Promise<User> {
  const users = dataSource.getRepository(User);
  const email = normalizeEmail(settings.SEED_USER_EMAIL);

  await users.upsert(
    {
      email,
      passwordHash: await hash(settings.SEED_USER_PASSWORD, bcryptRounds),
      fullname: settings.SEED_USER_FULLNAME,
    },
    ['email'],
  );

  return users.findOneByOrFail({ email });
}
