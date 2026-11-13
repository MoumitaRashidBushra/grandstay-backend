import { PrismaClient } from '@prisma/client';

// One shared client per test file; Vitest gives each file its own module registry.
export const prisma = new PrismaClient();

// Empties every application table and restarts id sequences, keeping Prisma's migration history.
export async function resetDatabase(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`,
  );
}

export const disconnectDatabase = () => prisma.$disconnect();
