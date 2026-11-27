import { execSync } from 'node:child_process';

import { applyTestDatabaseUrl } from './load-env.js';

// Runs once before the API suite: points at grandstay_db locally (or *_test in CI),
// then applies the committed migrations so the schema matches production.
export default function globalSetup(): void {
  applyTestDatabaseUrl();

import { PrismaClient } from '@prisma/client';
import { loadTestEnvironment } from './load-test-env.js';

// Runs once before the API suite: confines migrations to the isolated test schema.
export default async function globalSetup(): Promise<void> {
  loadTestEnvironment();

  const url = process.env.DATABASE_URL;
  if (!url)
    throw new Error(
      'DATABASE_URL is not set. Add it to .env or export it before running API tests.',
    );

  // API tests truncate every table. Allow the local app database and disposable *_test databases.
  const dbName = new URL(url).pathname.slice(1);
  const allowed = dbName === 'grandstay_db' || dbName.endsWith('_test');
  if (process.env.NODE_ENV !== 'test' || !allowed) {
    throw new Error(
      `Refusing to run API tests: NODE_ENV must be "test" and the database must be grandstay_db or end in "_test" (got NODE_ENV=${process.env.NODE_ENV}, database=${dbName}).`,
  const parsedUrl = new URL(url);
  const dbName = decodeURIComponent(parsedUrl.pathname.slice(1));
  const schema = parsedUrl.searchParams.get('schema');
  if (
    process.env.NODE_ENV !== 'test' ||
    (dbName !== 'grandstay_db' && !dbName.endsWith('_test')) ||
    schema !== 'grandstay_test'
  ) {
    throw new Error(
      `Refusing to run API tests: NODE_ENV must be "test", database must be grandstay_db or end in "_test", and schema must be "grandstay_test" (got NODE_ENV=${process.env.NODE_ENV}, database=${dbName}, schema=${schema}).`,
    );
  }

  // The suite resets all tables. Create and use a dedicated schema in the chosen
  // database so GrandStay's public schema and application data stay untouched.
  const publicSchemaUrl = new URL(url);
  publicSchemaUrl.searchParams.set('schema', 'public');
  const setupClient = new PrismaClient({
    datasources: { db: { url: publicSchemaUrl.toString() } },
  });
  try {
    await setupClient.$executeRawUnsafe(
      'CREATE SCHEMA IF NOT EXISTS "grandstay_test"',
    );
  } finally {
    await setupClient.$disconnect();
  }

  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
}
