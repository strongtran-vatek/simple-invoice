import { DataSource } from 'typeorm';
import { loadEnvironment } from '../config/load-environment.js';
import { buildDataSourceOptions } from './typeorm.options.js';

/**
 * DataSource for the TypeORM CLI (`npm run migration:*`), which runs outside
 * Nest and therefore loads the environment itself.
 */
export default new DataSource(buildDataSourceOptions(loadEnvironment()));
