import { describe, expect, it, vi } from 'vitest';
import { configureApp } from './configure-app.js';

describe('configureApp', () => {
  it('enables cookies, validation, and the /api/v1 prefix', () => {
    const app = {
      use: vi.fn(),
      useGlobalPipes: vi.fn(),
      setGlobalPrefix: vi.fn(),
    };

    configureApp(app as never);

    expect(app.use).toHaveBeenCalledOnce();
    expect(app.useGlobalPipes).toHaveBeenCalledOnce();
    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api/v1');
  });
});
