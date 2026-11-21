import { PostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

export interface PostgresServer {
  host: string;
  port: number;
  user: string;
  password: string;
}

declare module 'vitest' {
  export interface ProvidedContext {
    postgres: PostgresServer;
  }
}

/**
 * Starts one throwaway PostgreSQL server for the whole e2e run. Each test file
 * then creates its own database on it (see test-app.ts), so files stay isolated
 * without paying for a container each. Needs Docker to be running.
 */
export default async function setup(project: TestProject) {
  const container = await new PostgreSqlContainer('postgres:16-alpine').start();

  project.provide('postgres', {
    host: container.getHost(),
    port: container.getPort(),
    user: container.getUsername(),
    password: container.getPassword(),
  });

  return async () => {
    await container.stop();
  };
}
