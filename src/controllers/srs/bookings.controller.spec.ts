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

import { BookingsController } from './bookings.controller.js';

describe('BookingsController', () => {
  const prismaMock = { booking: { findUnique: vi.fn() } };
  let controller: BookingsController;

  const reqFor = (role: string, sub = '7') =>
    ({ user: { role, sub, email: 'a@b.c' } }) as never;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new BookingsController(prismaMock as never);
  });

  describe('stub endpoints', () => {
    it('quote is not implemented', () => {
      expect(() => controller.quote({})).toThrow(NotImplementedException);
    });

    it('createBooking is not implemented', () => {
      expect(() => controller.createBooking({}, 'key')).toThrow(
        NotImplementedException,
      );
    });

    it('getMyBookings is not implemented', () => {
      expect(() => controller.getMyBookings({})).toThrow(
        NotImplementedException,
      );
    });
  });

  // getBooking and getConfirmation share assertBookingReadAccess
  describe.each([
    ['getBooking', (c: BookingsController, req: never) => c.getBooking('REF', req)],
    [
      'getConfirmation',
      (c: BookingsController, req: never) => c.getConfirmation('REF', req),
    ],
  ])('%s', (_name, call) => {
    it('forbids an unknown role', async () => {
      await expect(call(controller, reqFor('GUEST'))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prismaMock.booking.findUnique).not.toHaveBeenCalled();
    });

    it('returns 404 when the booking does not exist', async () => {
      prismaMock.booking.findUnique.mockResolvedValue(null);
      await expect(call(controller, reqFor('ADMIN'))).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prismaMock.booking.findUnique).toHaveBeenCalledWith({
        where: { reference: 'REF' },
        select: { customerId: true },
      });
    });

    it('returns 404 when a customer asks for another customer\'s booking', async () => {
      prismaMock.booking.findUnique.mockResolvedValue({ customerId: 99n });
      await expect(
        call(controller, reqFor('CUSTOMER', '7')),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lets a customer reach their own booking (then not implemented)', async () => {
      prismaMock.booking.findUnique.mockResolvedValue({ customerId: 7n });
      await expect(
        call(controller, reqFor('CUSTOMER', '7')),
      ).rejects.toBeInstanceOf(NotImplementedException);
    });

    it('lets staff reach any booking (then not implemented)', async () => {
      prismaMock.booking.findUnique.mockResolvedValue({ customerId: 99n });
      await expect(
        call(controller, reqFor('RECEPTIONIST')),
      ).rejects.toBeInstanceOf(NotImplementedException);
    });
  });

  describe('cancelBooking', () => {
    const cancel = (req: never) => controller.cancelBooking('REF', req, 'key');

    it('forbids a receptionist', async () => {
      await expect(cancel(reqFor('RECEPTIONIST'))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prismaMock.booking.findUnique).not.toHaveBeenCalled();
    });

    it('returns 404 when the booking does not exist', async () => {
      prismaMock.booking.findUnique.mockResolvedValue(null);
      await expect(cancel(reqFor('ADMIN'))).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns 404 for another customer\'s booking', async () => {
      prismaMock.booking.findUnique.mockResolvedValue({ customerId: 99n });
      await expect(cancel(reqFor('CUSTOMER', '7'))).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('lets a customer cancel their own booking (then not implemented)', async () => {
      prismaMock.booking.findUnique.mockResolvedValue({ customerId: 7n });
      await expect(cancel(reqFor('CUSTOMER', '7'))).rejects.toBeInstanceOf(
        NotImplementedException,
      );
    });

    it('lets an admin cancel any booking (then not implemented)', async () => {
      prismaMock.booking.findUnique.mockResolvedValue({ customerId: 99n });
      await expect(cancel(reqFor('ADMIN'))).rejects.toBeInstanceOf(
        NotImplementedException,
      );
    });
  });
});