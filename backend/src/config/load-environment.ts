import { type Environment, validateEnvironment } from './env.validation.js';

/**
 * Loads and validates the environment for scripts that run outside Nest (the
 * TypeORM CLI and the seed). Reads `backend/.env`, then the repository's root
 * `.env`; variables already set in the process win over both.
 */
export function loadEnvironment(): Environment {
  for (const file of ['.env', '../.env']) {
    try {
      process.loadEnvFile(file);
    } catch {
      // A missing file is fine: in Docker the variables come from the environment.
    }
  }
  return validateEnvironment(process.env);
}
