import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ForbiddenException,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';

vi.mock('@prisma/client', () => ({
  UserRole: { ADMIN: 'ADMIN', RECEPTIONIST: 'RECEPTIONIST', CUSTOMER: 'CUSTOMER' },
  PrismaClient: class {},
}));

// vi.mock('@prisma/client', () => ({
//   UserRole: { ADMIN: 'ADMIN', RECEPTIONIST: 'RECEPTIONIST', CUSTOMER: 'CUSTOMER' },
// }));

import { InvoicesController } from './invoices.controller.js';

describe('InvoicesController', () => {
  const prismaMock = { invoice: { findUnique: vi.fn() } };
  let controller: InvoicesController;

  const reqFor = (role: string, sub = '5') =>
    ({ user: { role, sub, email: 'a@b.c' } }) as never;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new InvoicesController(prismaMock as never);
  });

  it('forbids an unknown role', async () => {
    await expect(
      controller.getInvoice('INV-1', reqFor('GUEST')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prismaMock.invoice.findUnique).not.toHaveBeenCalled();
  });

  it('returns 404 when the invoice does not exist', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue(null);
    await expect(
      controller.getInvoice('INV-1', reqFor('ADMIN')),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prismaMock.invoice.findUnique).toHaveBeenCalledWith({
      where: { number: 'INV-1' },
      select: { booking: { select: { customerId: true } } },
    });
  });

  it('returns 404 for another customer\'s invoice', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue({
      booking: { customerId: 99n },
    });
    await expect(
      controller.getInvoice('INV-1', reqFor('CUSTOMER', '5')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lets a customer reach their own invoice (then not implemented)', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue({
      booking: { customerId: 5n },
    });
    await expect(
      controller.getInvoice('INV-1', reqFor('CUSTOMER', '5')),
    ).rejects.toBeInstanceOf(NotImplementedException);
  });

  it('lets staff reach any invoice (then not implemented)', async () => {
    prismaMock.invoice.findUnique.mockResolvedValue({
      booking: { customerId: 99n },
    });
    await expect(
      controller.getInvoice('INV-1', reqFor('RECEPTIONIST')),
    ).rejects.toBeInstanceOf(NotImplementedException);
  });
});