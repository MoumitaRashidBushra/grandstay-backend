import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { RegisterDto } from './dto/register.dto.js';
import { validatedBody } from './validated-body.pipe.js';

describe('validatedBody', () => {
  const pipe = validatedBody(RegisterDto);

  it('returns a validated registration body', async () => {
    const result = await pipe.transform({
      fullName: 'Rahim',
      email: 'rahim@example.com',
      mobile: '01711000001',
      password: 'Str0ng!Pass',
      extra: 'ignored',
    });

    expect(result).toBeInstanceOf(RegisterDto);
    expect(result.email).toBe('rahim@example.com');
    expect(result).not.toHaveProperty('extra');
  });

  it('rejects an invalid body', async () => {
    await expect(pipe.transform({})).rejects.toThrow(BadRequestException);
    await expect(pipe.transform(null)).rejects.toThrow(BadRequestException);
  });
});
