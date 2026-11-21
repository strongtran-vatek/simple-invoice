import type { DataSourceOptions } from 'typeorm';
import type { Environment } from '../config/env.validation.js';
import { InvoiceItem } from '../invoices/invoice-item.entity.js';
import { Invoice } from '../invoices/invoice.entity.js';
import { User } from '../users/user.entity.js';
import { migrations } from './migrations/index.js';

export const entities = [User, Invoice, InvoiceItem];

type DatabaseSettings = Pick<
  Environment,
  'DB_HOST' | 'DB_PORT' | 'DB_USER' | 'DB_PASSWORD' | 'DB_NAME'
>;

/**
 * The one place database connection options are built, shared by the Nest
 * application, the TypeORM CLI and the seed script.
 */
export function buildDataSourceOptions(
  settings: DatabaseSettings,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: settings.DB_HOST,
    port: settings.DB_PORT,
    username: settings.DB_USER,
    password: settings.DB_PASSWORD,
    database: settings.DB_NAME,
    entities,
    migrations,
    // The schema changes only through migrations (docs/adr/0001).
    synchronize: false,
    // UUIDs come from the built-in gen_random_uuid(), so no extension is installed.
    uuidExtension: 'pgcrypto',
    installExtensions: false,
  };
}
