import { describe, it, expect, vi } from 'vitest';
import { NotImplementedException } from '@nestjs/common';

vi.mock('@prisma/client', () => ({
  UserRole: { ADMIN: 'ADMIN', RECEPTIONIST: 'RECEPTIONIST', CUSTOMER: 'CUSTOMER' },
}));

import {
  AdminStaffController,
  AdminRoomsController,
  AdminReportsController,
} from './admin.controller.js';

const staff = new AdminStaffController();
const rooms = new AdminRoomsController();
const reports = new AdminReportsController();

const stubs: Array<[string, () => unknown]> = [
  ['createStaff', () => staff.createStaff({})],
  ['updateStaff', () => staff.updateStaff('1', {})],
  ['listRooms', () => rooms.listRooms({})],
  ['getRoom', () => rooms.getRoom('1')],
  ['createRoom', () => rooms.createRoom({})],
  ['updateRoom', () => rooms.updateRoom('1', {})],
  ['deleteRoom', () => rooms.deleteRoom('1')],
  ['updateRoomStatus', () => rooms.updateRoomStatus('1', {})],
  ['getReservations', () => reports.getReservations({})],
  ['getDashboard', () => reports.getDashboard({})],
];

describe('admin controllers (skeleton endpoints)', () => {
  it.each(stubs)('%s is not implemented yet', (_name, call) => {
    expect(call).toThrow(NotImplementedException);
  });
});