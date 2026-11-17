import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';

import { AuthService, AccountLockedException } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';

vi.mock('argon2', () => ({
  verify: vi.fn(),
}));

describe('AuthService', () => {
  let authService: AuthService;
  let prisma: any;
  let jwtService: any;

  const mockUser = {
    id: BigInt(1),
    email: 'customer@example.com',
    fullName: 'Test Customer',
    passwordHash: 'hashed-password',
    role: 'CUSTOMER',
    isActive: true,
    mustResetPw: false,
    failedLogins: 0,
    lockedUntil: null,
    lastFailedLoginAt: null,
    failedLoginWindowStartedAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    prisma = {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      refreshToken: {
        create: vi.fn(),
        findUnique: vi.fn(),
        updateMany: vi.fn(),
      },
      $executeRaw: vi.fn(),
      $transaction: vi.fn(),
    };

    jwtService = {
      signAsync: vi.fn().mockResolvedValue('mock-access-token'),
    };

    authService = new AuthService(
      prisma as PrismaService,
      jwtService as JwtService,
    );
  });

  describe('login', () => {
    it('should successfully log in an active user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      vi.mocked(argon2.verify).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await authService.login({
        email: ' CUSTOMER@EXAMPLE.COM ',
        password: 'correct-password',
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'customer@example.com' },
      });

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe(mockUser.email);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          failedLogins: 0,
          lockedUntil: null,
          lastFailedLoginAt: null,
          failedLoginWindowStartedAt: null,
        },
      });

      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });

    it('should reject an unknown email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'unknown@example.com',
          password: 'password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject an inactive user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(
        authService.login({
          email: mockUser.email,
          password: 'password',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject a currently locked account', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        lockedUntil: new Date(Date.now() + 60000),
      });

      await expect(
        authService.login({
          email: mockUser.email,
          password: 'password',
        }),
      ).rejects.toThrow(AccountLockedException);
    });

    it('should record a failed login when the password is incorrect', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      vi.mocked(argon2.verify).mockResolvedValue(false);

      await expect(
        authService.login({
          email: mockUser.email,
          password: 'wrong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('should record a failed login if password verification throws', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      vi.mocked(argon2.verify).mockRejectedValue(
        new Error('Verification failed'),
      );

      await expect(
        authService.login({
          email: mockUser.email,
          password: 'wrong-password',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(prisma.$executeRaw).toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('should reject when no refresh token is provided', async () => {
      await expect(authService.refresh()).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject an unknown refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(
        authService.refresh('invalid-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject a revoked refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: BigInt(1),
        userId: BigInt(1),
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
        user: mockUser,
      });

      await expect(
        authService.refresh('revoked-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject an expired refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: BigInt(1),
        userId: BigInt(1),
        revokedAt: null,
        expiresAt: new Date(Date.now() - 60000),
        user: mockUser,
      });

      await expect(
        authService.refresh('expired-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject a token belonging to an inactive user', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: BigInt(1),
        userId: BigInt(1),
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60000),
        user: { ...mockUser, isActive: false },
      });

      await expect(
        authService.refresh('inactive-user-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should rotate a valid refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: BigInt(1),
        userId: BigInt(1),
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60000),
        user: mockUser,
      });

      const tx = {
        refreshToken: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          create: vi.fn().mockResolvedValue({}),
        },
      };

      prisma.$transaction.mockImplementation(async (callback: any) =>
        callback(tx),
      );

      const result = await authService.refresh('valid-refresh-token');

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe('valid-refresh-token');

      expect(tx.refreshToken.updateMany).toHaveBeenCalled();
      expect(tx.refreshToken.create).toHaveBeenCalled();
    });

    it('should reject refresh token reuse during rotation', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: BigInt(1),
        userId: BigInt(1),
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60000),
        user: mockUser,
      });

      const tx = {
        refreshToken: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          create: vi.fn(),
        },
      };

      prisma.$transaction.mockImplementation(async (callback: any) =>
        callback(tx),
      );

      await expect(
        authService.refresh('already-used-token'),
      ).rejects.toThrow(UnauthorizedException);

      expect(tx.refreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should do nothing when no refresh token is provided', async () => {
      await expect(authService.logout()).resolves.toBeUndefined();

      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('should revoke the supplied refresh token', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await authService.logout('valid-refresh-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            revokedAt: null,
            tokenHash: expect.any(String),
          }),
          data: {
            revokedAt: expect.any(Date),
          },
        }),
      );
    });
  });
});
