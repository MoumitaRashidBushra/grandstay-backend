import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException, type ExecutionContext } from '@nestjs/common';

import { RolesGuard } from './roles.guard.js';
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

  it('reads roles from both the handler and the class', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(undefined);

    guard.canActivate(makeContext());

    expect(reflectorMock.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      handler,
      TestClass,
    ]);
  });

  it('allows access when no roles are required', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('allows access when the required roles list is empty', () => {
    reflectorMock.getAllAndOverride.mockReturnValue([]);
    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('blocks when roles are required but there is no user', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(['ADMIN']);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('blocks a user whose role is not allowed', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(['ADMIN']);
    expect(() => guard.canActivate(makeContext({ role: 'CUSTOMER' }))).toThrow(
      ForbiddenException,
    );
  });

  it('allows a user whose role is allowed', () => {
    reflectorMock.getAllAndOverride.mockReturnValue(['ADMIN', 'RECEPTIONIST']);
    expect(guard.canActivate(makeContext({ role: 'RECEPTIONIST' }))).toBe(true);
  });
});