// src/auth/decorators/roles.decorator.spec.ts
import { describe, it, expect } from 'vitest';
import { Roles, ROLES_KEY } from './roles.decorator.js';

describe('Roles decorator', () => {
  it('stores the allowed roles as metadata', () => {
    const target = () => undefined;

    Roles('ADMIN' as never, 'RECEPTIONIST' as never)(target as never);

    expect(Reflect.getMetadata(ROLES_KEY, target)).toEqual([
      'ADMIN',
      'RECEPTIONIST',
    ]);
  });
});