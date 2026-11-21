import { DataSource } from 'typeorm';
import { dateInTimeZone } from '../../common/clock.js';
import { loadEnvironment } from '../../config/load-environment.js';
import { buildDataSourceOptions } from '../typeorm.options.js';
import { seedDefaultUser } from './seed-default-user.js';
import { seedInvoices } from './seed-invoices.js';
import { validateSeedSettings } from './seed-settings.js';

/**
 * Entry point for `npm run seed`. Applies pending migrations first, so it
 * works against an empty database.
 *
 *   npm run seed              creates the default user; adds sample invoices
 *                             only if there are none yet
 *   npm run seed -- --reset   deletes every invoice, then adds the samples again
 */
async function main(): Promise<void> {
  const environment = loadEnvironment();
  const settings = validateSeedSettings(process.env);
  const reset = process.argv.includes('--reset');

  const dataSource = new DataSource(buildDataSourceOptions(environment));
  await dataSource.initialize();
  try {
    await dataSource.runMigrations();

    const user = await seedDefaultUser(dataSource, settings);
    console.log(`Seeded default user ${user.email}`);

    const count = await seedInvoices(dataSource, {
      createdBy: user.id,
      today: dateInTimeZone(new Date(), environment.APP_TIMEZONE),
      reset,
    });
    console.log(
      count > 0
        ? `Seeded ${count} invoices`
        : 'Invoices already exist; left them unchanged (use --reset to replace them)',
    );
  } finally {
    await dataSource.destroy();
  }
}

await main();
