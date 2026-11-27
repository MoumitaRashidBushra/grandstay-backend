import {
  BadRequestException,
} from '@nestjs/common';
import * as argon2 from 'argon2';

// NFR-SEC-01: Argon2id, 19 MiB, 2 iterations. 8–64 characters with a letter and a digit.
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/;

export const PASSWORD_MESSAGE =
  'password must be 8-64 characters and include a letter and a digit';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} satisfies argon2.HashOptions;

export function assertPasswordPolicy(password: string): void {
  if (!PASSWORD_PATTERN.test(password)) {
    throw new BadRequestException({
      statusCode: 400,
      code: 'VALIDATION_FAILED',
      message: [PASSWORD_MESSAGE],
      error: 'Bad Request',
    });
  }
}

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(
  passwordHash: string,
  plain: string,
): Promise<boolean> {
  try {
    return await argon2.verify(passwordHash, plain);
  } catch {
    return false;
  }
}
