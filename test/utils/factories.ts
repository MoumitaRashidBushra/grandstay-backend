import { Prisma, User, UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { prisma } from './db.js';

export const TEST_PASSWORD = 'Password@123';

let seq = 0;
const next = () => ++seq;

// Light Argon2id parameters keep tests fast. Login verifies any Argon2 hash.
const hash = (password: string) =>
  argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 12,
    timeCost: 1,
    parallelism: 1,
  });

export type UserOverrides = Partial<
  Omit<Prisma.UserCreateInput, 'passwordHash'>
> & { password?: string };

// Creates a user with unique email/mobile. Returns the row plus the plain password for logging in.
export async function createUser(
  overrides: UserOverrides = {},
): Promise<User & { password: string }> {
  const { password = TEST_PASSWORD, ...data } = overrides;
  const n = next();
  const user = await prisma.user.create({
    data: {
      fullName: `Test User ${n}`,
      email: `user${n}.${Date.now()}@test.example`,
      mobile: `017${String(n).padStart(8, '0')}`,
      role: UserRole.CUSTOMER,
      ...data,
      passwordHash: await hash(password),
    },
  });
  return { ...user, password };
}

export const createAdmin = (o: UserOverrides = {}) =>
  createUser({ role: UserRole.ADMIN, ...o });
export const createReceptionist = (o: UserOverrides = {}) =>
  createUser({ role: UserRole.RECEPTIONIST, ...o });
export const createCustomer = (o: UserOverrides = {}) =>
  createUser({ role: UserRole.CUSTOMER, ...o });
