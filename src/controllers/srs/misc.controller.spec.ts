import { describe, it, expect, vi } from 'vitest';
import { NotImplementedException } from '@nestjs/common';

vi.mock('@prisma/client', () => ({
  UserRole: { ADMIN: 'ADMIN', RECEPTIONIST: 'RECEPTIONIST', CUSTOMER: 'CUSTOMER' },
}));

import {
  RegistrationSkeletonController,
  MePasswordSkeletonController,
  HealthSkeletonController,
} from './misc.controller.js';

describe('misc controllers', () => {
  it('register is not implemented yet', () => {
    expect(() => new RegistrationSkeletonController().register({})).toThrow(
      NotImplementedException,
    );
  });

  it('changePassword is not implemented yet', () => {
    expect(() => new MePasswordSkeletonController().changePassword({})).toThrow(
      NotImplementedException,
    );
  });

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