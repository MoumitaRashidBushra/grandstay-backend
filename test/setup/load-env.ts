import { existsSync, readFileSync } from 'node:fs';

// Local API tests use the app database from .env (grandstay_db on this machine).
// CI sets DATABASE_URL before the process starts, and that value wins.
applyTestDatabaseUrl();

export function applyTestDatabaseUrl(): void {
  const preset = process.env.DATABASE_URL;
  if (existsSync('.env.test')) process.loadEnvFile('.env.test');
  if (!preset) {
    const appUrl = databaseUrlFromAppEnv();
    if (appUrl) process.env.DATABASE_URL = appUrl;
  }
}

function databaseUrlFromAppEnv(): string | undefined {
  if (!existsSync('.env')) return undefined;
  const line = readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.startsWith('DATABASE_URL='));
  if (!line) return undefined;
  let value = line.slice('DATABASE_URL='.length).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value || undefined;
}
