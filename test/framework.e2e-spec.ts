import { UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { disconnectDatabase, prisma, resetDatabase } from './utils/db.js';
import {
  createAdmin,
  createCustomer,
  createReceptionist,
} from './utils/factories.js';

// Sanity checks for the test harness itself: migrated schema, isolation and factories.
describe('API test framework', () => {
  beforeEach(resetDatabase);
  afterAll(disconnectDatabase);

  it('is connected to a migrated *_test database', async () => {
    const [{ db }] = await prisma.$queryRaw<
      { db: string }[]
    >`SELECT current_database() AS db`;
    expect(db).toMatch(/_test$/);
    const migrations = await prisma.$queryRaw<
      { n: bigint }[]
    >`SELECT count(*) AS n FROM _prisma_migrations`;
    expect(Number(migrations[0].n)).toBeGreaterThan(0);
  });

  it('starts every test with empty tables', async () => {
    await createCustomer();
    await resetDatabase();
    expect(await prisma.user.count()).toBe(0);
  });

  it('creates one user per role with a verifiable password', async () => {
    const [admin, receptionist, customer] = await Promise.all([
      createAdmin(),
      createReceptionist(),
      createCustomer(),
    ]);
    expect([admin.role, receptionist.role, customer.role]).toEqual([
      UserRole.ADMIN,
      UserRole.RECEPTIONIST,
      UserRole.CUSTOMER,
    ]);
    expect(await bcrypt.compare(customer.password, customer.passwordHash)).toBe(
      true,
    );
  });

  it('enforces database constraints (unique email)', async () => {
    const user = await createCustomer();
    await expect(createCustomer({ email: user.email })).rejects.toThrow();
  });
});
