import { describe, expect, it, vi } from 'vitest';
import { UserRole } from '@prisma/client';

import { ROLES_KEY } from '../../auth/decorators/roles.decorator.js';
import { AdminStaffController } from './admin-staff.controller.js';

describe('AdminStaffController', () => {
  const staffService = {
    list: vi.fn().mockResolvedValue({ staff: [] }),
    create: vi.fn().mockResolvedValue({ id: '4' }),
    update: vi.fn().mockResolvedValue({ id: '4' }),
  };
  const controller = new AdminStaffController(staffService as never);

  it('allows only administrators', () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminStaffController)).toEqual([
      UserRole.ADMIN,
    ]);
  });

  it('lists staff through the service', async () => {
    const query = { search: 'rubina' };

    await expect(controller.listStaff(query as never)).resolves.toEqual({
      staff: [],
    });
    expect(staffService.list).toHaveBeenCalledWith(query);
  });

  it('creates a staff account through the service', async () => {
    const body = { email: 'new@grandstay.example' };

    await expect(controller.createStaff(body as never)).resolves.toEqual({
      id: '4',
    });
    expect(staffService.create).toHaveBeenCalledWith(body);
  });

  it('updates a staff account for the signed-in admin', async () => {
    const body = { isActive: false };
    const request = { user: { sub: '1' } };

    await expect(
      controller.updateStaff('4', body as never, request as never),
    ).resolves.toEqual({ id: '4' });
    expect(staffService.update).toHaveBeenCalledWith('4', body, '1');
  });
});
