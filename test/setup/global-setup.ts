import { execSync } from 'node:child_process';
import { applyTestDatabaseUrl } from './load-env.js';

// Runs once before the API suite: points at grandstay_db locally (or *_test in CI),
// then applies the committed migrations so the schema matches production.
export default function globalSetup(): void {
  applyTestDatabaseUrl();
  const url = process.env.DATABASE_URL;
  if (!url)
    throw new Error(
      'DATABASE_URL is not set. Copy .env.test or export it before running the API tests.',
    );

  // API tests truncate every table. Allow the local app database and disposable *_test databases.
  const dbName = new URL(url).pathname.slice(1);
  const allowed = dbName === 'grandstay_db' || dbName.endsWith('_test');
  if (process.env.NODE_ENV !== 'test' || !allowed) {
    throw new Error(
      `Refusing to run API tests: NODE_ENV must be "test" and the database must be grandstay_db or end in "_test" (got NODE_ENV=${process.env.NODE_ENV}, database=${dbName}).`,
    );
  }

  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
}
