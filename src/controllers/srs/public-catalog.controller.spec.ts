import { describe, it, expect, vi } from 'vitest';
import { NotImplementedException } from '@nestjs/common';

vi.mock('@prisma/client', () => ({
  UserRole: { ADMIN: 'ADMIN', RECEPTIONIST: 'RECEPTIONIST', CUSTOMER: 'CUSTOMER' },
}));

import {
  SettingsController,
  CategoriesController,
  AvailabilityController,
} from './public-catalog.controller.js';

describe('SettingsController', () => {
  const controller = new SettingsController();

  it('getSettings returns the public skeleton response', () => {
    expect(controller.getSettings()).toMatchObject({ access: 'public' });
  });

  it('updateSettings is not implemented yet', () => {
    expect(() => controller.updateSettings({})).toThrow(NotImplementedException);
  });
});

describe('CategoriesController', () => {
  const controller = new CategoriesController();

  it('getCategories returns the public skeleton response', () => {
    expect(controller.getCategories()).toMatchObject({ access: 'public' });
  });

  it('getCategory returns the public skeleton response', () => {
    expect(controller.getCategory('1')).toMatchObject({ access: 'public' });
  });

  it('updateCategory is not implemented yet', () => {
    expect(() => controller.updateCategory({})).toThrow(NotImplementedException);
  });
});

describe('AvailabilityController', () => {
  it('echoes the search query back', () => {
    const query = { checkIn: '2026-01-01', checkOut: '2026-01-03', guests: '2' };
    expect(new AvailabilityController().getAvailability(query)).toMatchObject({
      access: 'public',
      query,
    });
  });
});