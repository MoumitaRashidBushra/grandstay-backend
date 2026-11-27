import { describe, it, expect, vi } from 'vitest';

// Replace PrismaClient so no generated client or database is needed.
vi.mock('@prisma/client', () => ({
  PrismaClient: class {
    $connect = vi.fn().mockResolvedValue(undefined);
    $disconnect = vi.fn().mockResolvedValue(undefined);
  },
}));

import { PrismaService } from './prisma.service.js';

describe('PrismaService', () => {
  it('connects on module init', async () => {
    const service = new PrismaService();
    await service.onModuleInit();
    expect(service.$connect).toHaveBeenCalledTimes(1);
  });

  it('disconnects on module destroy', async () => {
    const service = new PrismaService();
    await service.onModuleDestroy();
    expect(service.$disconnect).toHaveBeenCalledTimes(1);
  });
});