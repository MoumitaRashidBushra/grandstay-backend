import { Prisma, User, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from './db.js';

export const TEST_PASSWORD = 'Password@123';

let seq = 0;
const next = () => ++seq;

// Low bcrypt cost keeps tests fast; the hash format is the same as production.
const hash = (password: string) => bcrypt.hash(password, 4);

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
