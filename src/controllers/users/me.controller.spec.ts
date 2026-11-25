import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { ROLES_KEY } from '../../auth/decorators/roles.decorator.js';
import { MeController } from './me.controller.js';

describe('MeController', () => {
  const prismaMock = { user: { findUnique: vi.fn() } };
  let controller: MeController;

  const request = { user: { sub: '42' } } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new MeController(prismaMock as never);
  });

  it('returns the profile with the id converted to a string', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 42n,
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      mobile: '0123456789',
      role: 'CUSTOMER',
      mustResetPw: false,
    });

    const result = await controller.getProfile(request);

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: 42n },
      select: {
        id: true,
        fullName: true,
        email: true,
        mobile: true,
        role: true,
        mustResetPw: true,
      },
    });
    expect(result).toEqual({
      id: '42',
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      mobile: '0123456789',
      role: 'CUSTOMER',
      mustResetPw: false,
    });
  });

  it('allows every signed-in role to read their own profile', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, MeController.prototype.getProfile),
    ).toEqual([UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.CUSTOMER]);
  });

  it('throws NotFoundException when the user does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(controller.getProfile(request)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
