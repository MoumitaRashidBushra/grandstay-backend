import { describe, it, expect, vi } from 'vitest';
import { NotImplementedException } from '@nestjs/common';

vi.mock('@prisma/client', () => ({
  UserRole: { ADMIN: 'ADMIN', RECEPTIONIST: 'RECEPTIONIST', CUSTOMER: 'CUSTOMER' },
}));

import { DeskController } from './desk.controller.js';

const desk = new DeskController();

const stubs: Array<[string, () => unknown]> = [
  ['findBookings', () => desk.findBookings('smith')],
  ['getArrivals', () => desk.getArrivals('2026-01-01')],
  ['getDepartures', () => desk.getDepartures('2026-01-01')],
  ['checkIn', () => desk.checkIn('REF')],
  ['checkOut', () => desk.checkOut('REF')],
];

describe('DeskController (skeleton endpoints)', () => {
  it.each(stubs)('%s is not implemented yet', (_name, call) => {
    expect(call).toThrow(NotImplementedException);
  });
});