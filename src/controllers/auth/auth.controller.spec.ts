import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';

import { AuthController } from './auth.controller.js';
import { AccountLockedException } from '../../services/auth/auth.service.js';

describe('AuthController', () => {
  const authServiceMock = {
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
  };

  const resMock = {
    cookie: vi.fn(),
    setHeader: vi.fn(),
    clearCookie: vi.fn(),
  };

  const cookieOptions = {
    httpOnly: true,
    sameSite: 'strict',
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };

  let controller: AuthController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AuthController(authServiceMock as never);
  });

  describe('login', () => {
    const dto = { email: 'jane@example.com', password: 'secret' } as never;

    it('sets the refresh cookie and omits the token from the body', async () => {
      authServiceMock.login.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
        user: { id: '1' },
      });

      const result = await controller.login(dto, resMock as never);

      expect(resMock.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh',
        expect.objectContaining(cookieOptions),
      );
      expect(result).toEqual({ accessToken: 'access', user: { id: '1' } });
      expect(result).not.toHaveProperty('refreshToken');
    });

    it('sets Retry-After and rethrows when the account is locked', async () => {
      const error = new AccountLockedException(30);
      authServiceMock.login.mockRejectedValue(error);

      await expect(controller.login(dto, resMock as never)).rejects.toBe(error);

      expect(resMock.setHeader).toHaveBeenCalledWith('Retry-After', '30');
      expect(resMock.cookie).not.toHaveBeenCalled();
    });

    it('rethrows other errors without setting Retry-After', async () => {
      const error = new UnauthorizedException('Invalid email or password');
      authServiceMock.login.mockRejectedValue(error);

      await expect(controller.login(dto, resMock as never)).rejects.toBe(error);

      expect(resMock.setHeader).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('rotates the cookie and returns only the access token', async () => {
      authServiceMock.refresh.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });
      const req = { cookies: { refreshToken: 'old-refresh' } };

      const result = await controller.refresh(req as never, resMock as never);

      expect(authServiceMock.refresh).toHaveBeenCalledWith('old-refresh');
      expect(resMock.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'new-refresh',
        expect.objectContaining(cookieOptions),
      );
      expect(result).toEqual({ accessToken: 'new-access' });
    });

    it('passes undefined when there are no cookies', async () => {
      authServiceMock.refresh.mockRejectedValue(
        new UnauthorizedException('Invalid refresh token'),
      );

      await expect(
        controller.refresh({} as never, resMock as never),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(authServiceMock.refresh).toHaveBeenCalledWith(undefined);
    });
  });

  describe('logout', () => {
    it('revokes the token and clears the cookie', async () => {
      authServiceMock.logout.mockResolvedValue(undefined);
      const req = { cookies: { refreshToken: 'refresh' } };

      const result = await controller.logout(req as never, resMock as never);

      expect(authServiceMock.logout).toHaveBeenCalledWith('refresh');
      expect(resMock.clearCookie).toHaveBeenCalledWith(
        'refreshToken',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/api/v1/auth',
        }),
      );
      expect(result).toEqual({ message: 'Logged out successfully' });
    });

    it('still succeeds when there is no cookie', async () => {
      authServiceMock.logout.mockResolvedValue(undefined);

      const result = await controller.logout({} as never, resMock as never);

      expect(authServiceMock.logout).toHaveBeenCalledWith(undefined);
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });
});