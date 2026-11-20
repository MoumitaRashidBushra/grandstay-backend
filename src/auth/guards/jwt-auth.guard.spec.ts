import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';

import { JwtAuthGuard } from './jwt-auth.guard.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

describe('JwtAuthGuard', () => {
  const jwtMock = { verifyAsync: vi.fn() };
  const reflectorMock = { getAllAndOverride: vi.fn() };
  const handler = () => undefined;
  class TestClass {}

  let guard: JwtAuthGuard;

  const makeContext = (request: Record<string, unknown>) =>
    ({
      getHandler: () => handler,
      getClass: () => TestClass,
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  const withAuth = (authorization?: string) => ({
    headers: authorization ? { authorization } : {},
  });

  beforeEach(() => {
    vi.clearAllMocks();
    reflectorMock.getAllAndOverride.mockReturnValue(false);
    guard = new JwtAuthGuard(jwtMock as never, reflectorMock as never);
  });

  it('skips the token check for @Public() routes', async () => {
    reflectorMock.getAllAndOverride.mockReturnValue(true);

    await expect(guard.canActivate(makeContext(withAuth()))).resolves.toBe(true);

    expect(reflectorMock.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      handler,
      TestClass,
    ]);
    expect(jwtMock.verifyAsync).not.toHaveBeenCalled();
  });

  it.each([
    ['no Authorization header', undefined],
    ['a non-Bearer scheme', 'Basic abc123'],
    ['a Bearer header with no token', 'Bearer'],
  ])('rejects %s', async (_label, header) => {
    await expect(
      guard.canActivate(makeContext(withAuth(header))),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtMock.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects an invalid or expired token', async () => {
    jwtMock.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    await expect(
      guard.canActivate(makeContext(withAuth('Bearer bad.token'))),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each([
    ['sub', { email: 'a@b.c', role: 'ADMIN' }],
    ['email', { sub: '1', role: 'ADMIN' }],
    ['role', { sub: '1', email: 'a@b.c' }],
  ])('rejects a token payload missing %s', async (_field, payload) => {
    jwtMock.verifyAsync.mockResolvedValue(payload);

    await expect(
      guard.canActivate(makeContext(withAuth('Bearer good.token'))),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches the payload to the request and allows access', async () => {
    const payload = { sub: '1', email: 'a@b.c', role: 'ADMIN' };
    jwtMock.verifyAsync.mockResolvedValue(payload);
    const request: Record<string, unknown> = withAuth('Bearer good.token');

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);

    expect(jwtMock.verifyAsync).toHaveBeenCalledWith('good.token');
    expect(request.user).toEqual(payload);
  });
});