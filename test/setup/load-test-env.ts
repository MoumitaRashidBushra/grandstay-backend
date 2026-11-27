import { existsSync } from 'node:fs';

const TEST_SCHEMA = 'grandstay_test';

export function loadTestEnvironment(): void {
  // Keep test credentials/settings ahead of the local app environment. CI-provided
  // variables already exist and process.loadEnvFile does not overwrite them.
  if (existsSync('.env.test')) process.loadEnvFile('.env.test');
  if (!process.env.DATABASE_URL && existsSync('.env')) {
    process.loadEnvFile('.env');
  }

  process.env.NODE_ENV = 'test';

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    const url = new URL(databaseUrl);
    url.searchParams.set('schema', TEST_SCHEMA);
    process.env.DATABASE_URL = url.toString();
  }
}
