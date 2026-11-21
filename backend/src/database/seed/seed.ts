import dataSource from '../data-source.js';
import { seedDefaultUser } from './seed-default-user.js';
import { validateSeedSettings } from './seed-settings.js';

/**
 * Entry point for `npm run seed`. Applies pending migrations first, so it
 * works against an empty database.
 */
async function main(): Promise<void> {
  const settings = validateSeedSettings(process.env);

  await dataSource.initialize();
  try {
    await dataSource.runMigrations();
    const user = await seedDefaultUser(dataSource, settings);
    console.log(`Seeded default user ${user.email}`);
  } finally {
    await dataSource.destroy();
  }
}

await main();
