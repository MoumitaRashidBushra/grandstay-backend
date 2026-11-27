import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import * as argon2 from 'argon2';

import { createHash, randomBytes } from 'node:crypto';

import { ChangePasswordDto } from '../../dto/change-password.dto.js';
import { LoginDto } from '../../dto/login.dto.js';
import { RegisterDto } from '../../dto/register.dto.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const MAX_FAILED_LOGINS = 5;

const PASSWORD_HASH_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export class AccountInactiveException extends HttpException {
  constructor() {
    super(
      {
        statusCode: 403,
        code: 'ACCOUNT_INACTIVE',
        message: 'Your account is deactivated. Please contact the hotel.',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

export class AccountLockedException extends HttpException {
  constructor(public readonly retryAfterSeconds: number) {
    super(
      {
        statusCode: 429,
        code: 'TEMPORARILY_LOCKED',
        message: 'Account temporarily locked. Try again later.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}
// Converts a raw refresh token into its SHA-256 hash.
  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  // Creates a new random refresh token and stores only its hash.
  private async createRefreshToken(userId: bigint) {
    const refreshToken = randomBytes(64).toString('hex');
    const tokenHash = this.hashRefreshToken(refreshToken);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    // The raw token is returned only so the controller can set the cookie.
    return refreshToken;
  }

private async recordFailedLogin(userId: bigint): Promise<void> {
    await this.prisma.$executeRaw`
      WITH login_attempt AS (
        SELECT
          id,
          CASE
            WHEN failed_login_window_started_at IS NULL
              OR failed_login_window_started_at <= NOW() - INTERVAL '15 minutes'
            THEN 1
            ELSE failed_logins + 1
          END AS next_count,
          CASE
            WHEN failed_login_window_started_at IS NULL
              OR failed_login_window_started_at <= NOW() - INTERVAL '15 minutes'
            THEN NOW()
            ELSE failed_login_window_started_at
          END AS next_window_start
        FROM users
        WHERE id = ${userId}
      )
      UPDATE users AS u
      SET
        failed_logins = login_attempt.next_count,
        failed_login_window_started_at = login_attempt.next_window_start,
        last_failed_login_at = NOW(),
        locked_until = CASE
          WHEN login_attempt.next_count >= ${MAX_FAILED_LOGINS}
          THEN NOW() + INTERVAL '15 minutes'
          ELSE NULL
        END
      FROM login_attempt
      WHERE u.id = login_attempt.id
    `;
  }

  async login(loginDto: LoginDto) {
    const email = loginDto.email.trim().toLowerCase();

    // 1. Find the user by email.
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

// Check whether this account is currently locked.
    const now = new Date();

    if (user.lockedUntil && user.lockedUntil > now) {
      const retryAfterSeconds = Math.ceil(
        (user.lockedUntil.getTime() - now.getTime()) / 1000,
      );

      throw new AccountLockedException(retryAfterSeconds);
    }

    // 3. Verify the submitted password against the stored Argon2id hash.
    let passwordIsValid = false;

    try {
      passwordIsValid = await argon2.verify(
        user.passwordHash,//the hash stored in PostgreSQL.
        loginDto.password,//the plain-text password submitted by the user.
      );
    } catch {
      passwordIsValid = false;
    }

    // Record an unsuccessful login attempt.
    if (!passwordIsValid) {
      await this.recordFailedLogin(user.id);

      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new AccountInactiveException();
    }

    // Successful login: reset all failed-login tracking fields.
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLogins: 0,
        lockedUntil: null,
        lastFailedLoginAt: null,
        failedLoginWindowStartedAt: null,
      },
    });
    // if (!passwordIsValid) {
    //   throw new UnauthorizedException('Invalid email or password');
    // }

    // 4. Generate the 15-min access token.
    const accessToken = await this.jwtService.signAsync({
      sub: user.id.toString(),//sub: User ID (the standard JWT subject claim)
      email: user.email,//email: User's email
      role: user.role,//role: ADMIN, RECEPTIONIST or CUSTOMER
    });

    // 5. Generate and store the hashed 7-day refresh token.
    const refreshToken = await this.createRefreshToken(user.id);

    // 6. Return the token and safe user information.
    // The controller must NOT include it in the JSON response.
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id.toString(),
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        mustResetPw: user.mustResetPw,//SRS requires newly created receptionists with temporary passwords to change their passwords at first login (FR-AUTH-03). Returning this flag allows the frontend to handle that requirement later.
      },
    };
  }

  async refresh(refreshToken?: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = this.hashRefreshToken(refreshToken);

    // 1. Find the stored token and its associated user.
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    // 2. Validate the token and account.
    const now = new Date();

    if (
      !storedToken ||
      storedToken.revokedAt !== null ||
      storedToken.expiresAt <= now ||
      !storedToken.user.isActive
    ) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // 3. Generate the replacement refresh token.
    const newRefreshToken = randomBytes(64).toString('hex');
    const newTokenHash = this.hashRefreshToken(newRefreshToken);
    const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    // 4. Revoke the old token and store the new one atomically.
    await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshToken.updateMany({
        where: {
          id: storedToken.id,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: {
          revokedAt: now,
        },
      });

      // Prevent reuse if another request has already rotated this token.
      if (revoked.count !== 1) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      await tx.refreshToken.create({
        data: {
          userId: storedToken.userId,
          tokenHash: newTokenHash,
          expiresAt: newExpiresAt,
        },
      });
    });

    // 5. Issue a fresh 15-minute access token.
    const accessToken = await this.jwtService.signAsync({
      sub: storedToken.user.id.toString(),
      email: storedToken.user.email,
      role: storedToken.user.role,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }


  async register(dto: RegisterDto) {
    if (dto.role !== undefined && dto.role !== UserRole.CUSTOMER) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: 'role',
        error: 'Unprocessable Entity',
        code: 'INVALID_ROLE',
      });
    }

    const passwordHash = await this.hashPassword(dto.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          fullName: dto.fullName.trim(),
          email: dto.email.trim().toLowerCase(),
          mobile: dto.mobile,
          passwordHash,
          role: UserRole.CUSTOMER,
          isActive: true,
          mustResetPw: false,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          mobile: true,
          role: true,
          isActive: true,
          mustResetPw: true,
        },
      });

      return {
        ...user,
        id: user.id.toString(),
      };
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException({
          statusCode: 409,
          code: 'EMAIL_TAKEN',
          message: 'Email is already registered',
        });
      }

      throw error;
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(userId) },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Unauthorized');
    }

    const currentPasswordMatches = await this.passwordMatches(
      user.passwordHash,
      dto.currentPassword,
    );

    if (!currentPasswordMatches) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'CURRENT_PASSWORD_WRONG',
        message: 'Current password is wrong',
      });
    }

    const passwordHash = await this.hashPassword(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          mustResetPw: false,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { mustResetPw: false };
  }

  async logout(refreshToken?: string): Promise<void> {
  // No refresh token means there is nothing to revoke.
  if (!refreshToken) {
    return;
  }

  // Hash the incoming token to match the hash stored in PostgreSQL.This converts the raw refresh token into a 64-character hexadecimal SHA-256 hash
  /*const tokenHash = createHash('sha256')
    .update(refreshToken)
    .digest('hex');*/

    const tokenHash = this.hashRefreshToken(refreshToken);


  // Revoke the matching token if it has not already been revoked.
  await this.prisma.refreshToken.updateMany({
    where: {
      tokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}
//updateMany doesnt throw error if token doesnot exist

  private async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      ...PASSWORD_HASH_OPTIONS,
    });
  }

  private async passwordMatches(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }
}

//randomBytes(64) creates a cryptographically random refresh token.

//createHash('sha256') hashes it before database storage. The raw token is never stored in PostgreSQL.

//expiresAt is seven days from creation.

//refresh() checks the token's existence, expiry, revocation status, and user account status.

//$transaction() ensures the old token is revoked and its replacement is stored together. If the old token has already been used, the second request is rejected.
