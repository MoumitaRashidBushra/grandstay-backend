import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

function contextFor(authorization?: string) {
  const request: { headers: { authorization?: string }; user?: unknown } = {
    headers: { authorization },
  };
  return {
    request,
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
    } as never,
  };
}

describe('JwtAuthGuard', () => {
  const user = { id: BigInt(1), isActive: true, email: 'a@example.com' };

  function guardWith(verify: JwtService['verifyAsync'], found = user) {
    const jwtService = { verifyAsync: verify } as JwtService;
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(found) },
    } as unknown as PrismaService;
    return new JwtAuthGuard(jwtService, prisma);
  }

  it('rejects a missing token', async () => {
    const { context } = contextFor();
    const guard = guardWith(vi.fn());
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an invalid token', async () => {
    const { context } = contextFor('Bearer bad');
    const guard = guardWith(vi.fn().mockRejectedValue(new Error('bad signature')));
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an inactive user', async () => {
    const { context } = contextFor('Bearer token');
    const guard = guardWith(
      vi.fn().mockResolvedValue({ sub: '1' }),
      { ...user, isActive: false },
    );
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('attaches the active user', async () => {
    const { request, context } = contextFor('Bearer token');
    const guard = guardWith(vi.fn().mockResolvedValue({ sub: '1' }));
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(user);
  });
});
