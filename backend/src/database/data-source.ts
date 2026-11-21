import { DataSource } from 'typeorm';
import { validateEnvironment } from '../config/env.validation.js';
import { buildDataSourceOptions } from './typeorm.options.js';

/**
 * DataSource for the TypeORM CLI (`npm run migration:*`), which runs outside
 * Nest and therefore loads the environment itself.
 */
for (const file of ['.env', '../.env']) {
  try {
    process.loadEnvFile(file);
  } catch {
    // A missing file is fine: in Docker the variables come from the environment.
  }
}

export default new DataSource(
  buildDataSourceOptions(validateEnvironment(process.env)),
);
