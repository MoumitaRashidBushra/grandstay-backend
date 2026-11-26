import { describe, it, expect, vi } from 'vitest';

vi.mock('@prisma/client', () => ({
  PrismaClient: class PrismaClient {},
  UserRole: { ADMIN: 'ADMIN', RECEPTIONIST: 'RECEPTIONIST', CUSTOMER: 'CUSTOMER' },
}));

import { HealthSkeletonController } from './misc.controller.js';

describe('misc controllers', () => {
  it('health returns ok', () => {
    expect(new HealthSkeletonController().health()).toMatchObject({
      status: 'ok',
      endpoint: 'health',
    });
  });

  it('ready returns ok', () => {
    expect(new HealthSkeletonController().ready()).toMatchObject({
      status: 'ok',
      endpoint: 'ready',
    });
  });
});