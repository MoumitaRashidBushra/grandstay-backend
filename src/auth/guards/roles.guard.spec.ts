import { beforeEach, describe, it, expect, vi } from 'vitest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';

import { RolesGuard } from './roles.guard.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

describe('RolesGuard', () => {
  const handler = () => undefined;
  class TestClass {}

  const reflectorMock = { getAllAndOverride: vi.fn() };
  const guard = new RolesGuard(reflectorMock as never);

  const makeContext = (user?: { role: string }) =>
    ({
      getHandler: () => handler,
      getClass: () => TestClass,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setMetadata = (metadata: { isPublic?: boolean; roles?: unknown }) => {
    reflectorMock.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) {
        return metadata.isPublic ?? false;
      }

      if (key === ROLES_KEY) {
        return metadata.roles;
      }

      return undefined;
    });
  };

  it('reads roles from both the handler and the class', () => {
    setMetadata({ roles: ['ADMIN'] });

    guard.canActivate(makeContext({ role: 'ADMIN' }));

    expect(reflectorMock.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      handler,
      TestClass,
    ]);
  });

  it('allows a public route without a role', () => {
    setMetadata({ isPublic: true });

    expect(guard.canActivate(makeContext())).toBe(true);
    expect(reflectorMock.getAllAndOverride).not.toHaveBeenCalledWith(
      ROLES_KEY,
      [handler, TestClass],
    );
  });

  it('blocks a protected route when no roles are required', () => {
    setMetadata({ roles: undefined });

    expect(() => guard.canActivate(makeContext({ role: 'ADMIN' }))).toThrow(
      ForbiddenException,
    );
  });

  it('blocks a protected route when the required roles list is empty', () => {
    setMetadata({ roles: [] });

    expect(() => guard.canActivate(makeContext({ role: 'ADMIN' }))).toThrow(
      ForbiddenException,
    );
  });

  it('blocks when roles are required but there is no user', () => {
    setMetadata({ roles: ['ADMIN'] });

    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('blocks a user whose role is not allowed', () => {
    setMetadata({ roles: ['ADMIN'] });

    expect(() => guard.canActivate(makeContext({ role: 'CUSTOMER' }))).toThrow(
      ForbiddenException,
    );
  });

  it('allows a user whose role is allowed', () => {
    setMetadata({ roles: ['ADMIN', 'RECEPTIONIST'] });

    expect(guard.canActivate(makeContext({ role: 'RECEPTIONIST' }))).toBe(true);
  });
});
