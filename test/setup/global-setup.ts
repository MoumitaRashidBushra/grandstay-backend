import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// Runs once before the API suite: checks we are pointed at a test database, then applies
// the committed migrations so the schema matches production.
export default function globalSetup(): void {
  if (existsSync('.env.test')) process.loadEnvFile('.env.test');
  const url = process.env.DATABASE_URL;
  if (!url)
    throw new Error(
      'DATABASE_URL is not set. Copy .env.test or export it before running the API tests.',
    );

  // Tests truncate every table, so refuse to run against anything that is not clearly a test DB.
  const dbName = new URL(url).pathname.slice(1);
  if (process.env.NODE_ENV !== 'test' || !dbName.endsWith('_test')) {
    throw new Error(
      `Refusing to run API tests: NODE_ENV must be "test" and the database name must end in "_test" (got NODE_ENV=${process.env.NODE_ENV}, database=${dbName}).`,
    );
  }

  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
}
