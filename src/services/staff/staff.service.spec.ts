import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StaffService } from './staff.service.js';

vi.mock('argon2', () => ({
  hash: vi.fn(),
  argon2id: 2,
}));

describe('StaffService', () => {
  const createdAt = new Date('2026-11-25T00:00:00.000Z');

  const admin = {
    id: 1n,
    fullName: 'System Admin',
    email: 'admin@grandstay.example',
    mobile: '01711000001',
    role: UserRole.ADMIN,
    isActive: true,
    mustResetPw: false,
    createdAt,
  };

  const receptionist = {
    id: 2n,
    fullName: 'Rubina Akter',
    email: 'reception1@grandstay.example',
    mobile: '01722000001',
    role: UserRole.RECEPTIONIST,
    isActive: true,
    mustResetPw: false,
    createdAt,
  };

  let prisma: {
    user: {
      findMany: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    refreshToken: {
      updateMany: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };
  let service: StaffService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(argon2.hash).mockResolvedValue('argon-hash');

    prisma = {
      user: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        count: vi.fn(),
        update: vi.fn(),
      },
      refreshToken: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: vi.fn(async (callback) => callback(prisma)),
    };

    service = new StaffService(prisma as never);
  });

  it('lists matching staff and counts the whole roster', async () => {
    prisma.user.findMany
      .mockResolvedValueOnce([receptionist])
      .mockResolvedValueOnce([
        { role: UserRole.ADMIN, isActive: true },
        { role: UserRole.RECEPTIONIST, isActive: false },
      ]);

    const result = await service.list({
      search: 'rubina',
      role: UserRole.RECEPTIONIST,
    });

    expect(prisma.user.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        role: UserRole.RECEPTIONIST,
        OR: [
          { fullName: { contains: 'rubina', mode: 'insensitive' } },
          { email: { contains: 'rubina', mode: 'insensitive' } },
        ],
      },
      select: expect.any(Object),
      orderBy: { fullName: 'asc' },
    });
    expect(result.staff).toEqual([
      {
        id: '2',
        fullName: 'Rubina Akter',
        email: 'reception1@grandstay.example',
        mobile: '01722000001',
        role: UserRole.RECEPTIONIST,
        isActive: true,
        mustResetPw: false,
        createdAt: createdAt.toISOString(),
      },
    ]);
    expect(result.summary).toEqual({
      total: 2,
      admins: 1,
      receptionists: 1,
      active: 1,
    });
  });

  it('creates an active staff account with a temporary password', async () => {
    prisma.user.create.mockResolvedValue({
      ...receptionist,
      mustResetPw: true,
    });

    const result = await service.create({
      fullName: ' Rubina Akter ',
      email: ' Reception1@grandstay.example ',
      mobile: '01722000001',
      password: 'Password@123',
    });

    expect(argon2.hash).toHaveBeenCalledWith('Password@123', {
      type: 2,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        fullName: 'Rubina Akter',
        email: 'reception1@grandstay.example',
        mobile: '01722000001',
        passwordHash: 'argon-hash',
        role: UserRole.RECEPTIONIST,
        isActive: true,
        mustResetPw: true,
      },
      select: expect.any(Object),
    });
    expect(result).not.toHaveProperty('passwordHash');
    expect(result.mustResetPw).toBe(true);
  });

  it('rejects a duplicate email when creating an account', async () => {
    prisma.user.create.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.create({
        fullName: 'Rubina Akter',
        email: 'reception1@grandstay.example',
        mobile: '01722000001',
        password: 'Password@123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rethrows unexpected create failures', async () => {
    prisma.user.create.mockRejectedValue(new Error('db down'));

    await expect(
      service.create({
        fullName: 'Rubina Akter',
        email: 'reception1@grandstay.example',
        mobile: '01722000001',
        password: 'Password@123',
      }),
    ).rejects.toThrow('db down');
  });

  it('updates staff details without revoking the session', async () => {
    prisma.user.findUnique.mockResolvedValue(receptionist);
    prisma.user.update.mockResolvedValue({
      ...receptionist,
      fullName: 'Rubina Khan',
    });

    const result = await service.update(
      '2',
      { fullName: ' Rubina Khan ' },
      '1',
    );

    expect(result.fullName).toBe('Rubina Khan');
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('deactivates an account and revokes its refresh tokens', async () => {
    prisma.user.findUnique.mockResolvedValue(receptionist);
    prisma.user.count.mockResolvedValue(1);
    prisma.user.update.mockResolvedValue({
      ...receptionist,
      isActive: false,
    });

    const result = await service.update('2', { isActive: false }, '1');

    expect(result.isActive).toBe(false);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 2n, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('sets a temporary password and revokes refresh tokens', async () => {
    prisma.user.findUnique.mockResolvedValue(receptionist);
    prisma.user.update.mockResolvedValue({
      ...receptionist,
      mustResetPw: true,
    });

    const result = await service.resetTemporaryPassword(
      '2',
      'Password@123',
      '1',
    );

    expect(result.mustResetPw).toBe(true);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
  });

  it('allows an admin to set a temporary password for another admin', async () => {
    const otherAdmin = {
      ...admin,
      id: 9n,
      email: 'backup.admin@grandstay.example',
    };
    prisma.user.findUnique.mockResolvedValue(otherAdmin);
    prisma.user.update.mockResolvedValue({
      ...otherAdmin,
      mustResetPw: true,
    });

    const result = await service.resetTemporaryPassword(
      '9',
      'Password@123',
      '1',
    );

    expect(result.mustResetPw).toBe(true);
    expect(result.role).toBe(UserRole.ADMIN);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
  });

  it('stops an admin from resetting their own password here', async () => {
    prisma.user.findUnique.mockResolvedValue(admin);

    await expect(
      service.resetTemporaryPassword('1', 'Password@123', '1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an empty update', async () => {
    await expect(service.update('2', {}, '1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an id that is not a number', async () => {
    await expect(
      service.update('abc', { fullName: 'Rubina' }, '1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns not found for a missing or customer account', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      ...receptionist,
      role: UserRole.CUSTOMER,
    });

    await expect(
      service.update('9', { fullName: 'Missing' }, '1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.update('2', { fullName: 'Customer' }, '1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('stops an admin from changing their own role or status', async () => {
    prisma.user.findUnique.mockResolvedValue(admin);

    await expect(
      service.update('1', { isActive: false }, '1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.count).not.toHaveBeenCalled();
  });

  it('keeps the last active administrator', async () => {
    prisma.user.findUnique.mockResolvedValue(admin);
    prisma.user.count.mockResolvedValue(0);

    await expect(
      service.update('1', { isActive: false }, '2'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('deactivates an administrator when another active administrator remains', async () => {
    prisma.user.findUnique.mockResolvedValue(admin);
    prisma.user.count.mockResolvedValue(1);
    prisma.user.update.mockResolvedValue({
      ...admin,
      isActive: false,
    });

    const result = await service.update('1', { isActive: false }, '8');

    expect(result.isActive).toBe(false);
  });

  it('rejects a duplicate email when updating an account', async () => {
    prisma.user.findUnique.mockResolvedValue(receptionist);
    prisma.$transaction.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.update('2', { email: 'admin@grandstay.example' }, '1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rethrows unexpected update failures', async () => {
    prisma.user.findUnique.mockResolvedValue(receptionist);
    prisma.$transaction.mockRejectedValue(new Error('db down'));

    await expect(
      service.update('2', { fullName: 'Rubina Khan' }, '1'),
    ).rejects.toThrow('db down');
  });
});
