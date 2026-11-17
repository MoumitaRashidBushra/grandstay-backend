import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserRole, type User } from '@prisma/client';

import { createHash, randomBytes } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { CreateStaffDto } from './dto/create-staff.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UpdateStaffDto } from './dto/update-staff.dto.js';
import { assertPasswordPolicy, hashPassword, verifyPassword } from './password.js';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const MAX_FAILED_LOGINS = 5;

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

  async register(dto: RegisterDto) {
    if (dto.role && dto.role !== UserRole.CUSTOMER) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: ['role is not allowed on registration'],
        error: 'Unprocessable Entity',
      });
    }

    assertPasswordPolicy(dto.password);
    const email = this.normalizeEmail(dto.email);
    await this.ensureEmailAvailable(email);

    try {
      const user = await this.prisma.user.create({
        data: {
          fullName: dto.fullName.trim(),
          email,
          mobile: dto.mobile,
          passwordHash: await hashPassword(dto.password),
          role: UserRole.CUSTOMER,
        },
      });
      return toPublicUser(user);
    } catch (error) {
      throw this.rethrowEmailTaken(error);
    }
  }

  async createReceptionist(dto: CreateStaffDto) {
    assertPasswordPolicy(dto.password);
    const email = this.normalizeEmail(dto.email);
    await this.ensureEmailAvailable(email);

    try {
      const user = await this.prisma.user.create({
        data: {
          fullName: dto.fullName.trim(),
          email,
          mobile: dto.mobile,
          passwordHash: await hashPassword(dto.password),
          role: UserRole.RECEPTIONIST,
          mustResetPw: true,
        },
      });
      return toPublicUser(user);
    } catch (error) {
      throw this.rethrowEmailTaken(error);
    }
  }

  async updateReceptionist(id: string, dto: UpdateStaffDto) {
    const userId = parseUserId(id);
    const existing = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!existing || existing.role !== UserRole.RECEPTIONIST) {
      throw receptionistNotFound();
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.user.update({
        where: { id: userId },
        data: { isActive: dto.isActive },
      });
      if (!dto.isActive) {
        await tx.refreshToken.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return row;
    });

    return toPublicUser(updated);
  }

  async getProfile(userId: bigint) {
    return toPublicUser(await this.requireActiveUser(userId));
  }

  async updateProfile(userId: bigint, dto: UpdateProfileDto) {
    await this.requireActiveUser(userId);
    const data: Prisma.UserUpdateInput = {};
    if (dto.fullName !== undefined) {
      data.fullName = dto.fullName.trim();
    }
    if (dto.mobile !== undefined) {
      data.mobile = dto.mobile;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data,
    });
    return toPublicUser(updated);
  }

  async changePassword(userId: bigint, dto: ChangePasswordDto) {
    const user = await this.requireActiveUser(userId);
    const currentMatches = await verifyPassword(
      user.passwordHash,
      dto.currentPassword,
    );
    if (!currentMatches) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'CURRENT_PASSWORD_WRONG',
        message: 'Current password is wrong',
      });
    }

    assertPasswordPolicy(dto.newPassword);
    const passwordHash = await hashPassword(dto.newPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          mustResetPw: false,
        },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    return { message: 'Password updated' };
  }

  async login(loginDto: LoginDto) {
    const email = this.normalizeEmail(loginDto.email);

    // 1. Find the user by email.
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // 2. Reject unknown or inactive users.
    if (!user || !user.isActive) {
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
    const passwordIsValid = await verifyPassword(
      user.passwordHash,
      loginDto.password,
    );

    // Record an unsuccessful login attempt.
    if (!passwordIsValid) {
      await this.recordFailedLogin(user.id);

      throw new UnauthorizedException('Invalid email or password');
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


async logout(refreshToken?: string) : Promise<void>{
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

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private async ensureEmailAvailable(email: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw emailTaken();
    }
  }

  private rethrowEmailTaken(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw emailTaken();
    }
    throw error;
  }

  private async requireActiveUser(userId: bigint): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Unauthenticated');
    }
    return user;
  }
}

function toPublicUser(user: User) {
  return {
    id: user.id.toString(),
    fullName: user.fullName,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    mustResetPw: user.mustResetPw,
    isActive: user.isActive,
  };
}

function emailTaken(): ConflictException {
  return new ConflictException({
    statusCode: 409,
    code: 'EMAIL_TAKEN',
    message: 'Email is already registered',
  });
}

function receptionistNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: 404,
    code: 'NOT_FOUND',
    message: 'Receptionist not found',
  });
}

function parseUserId(id: string): bigint {
  if (!/^\d+$/.test(id)) {
    throw receptionistNotFound();
  }
  return BigInt(id);
}

//randomBytes(64) creates a cryptographically random refresh token.

//createHash('sha256') hashes it before database storage. The raw token is never stored in PostgreSQL.

//expiresAt is seven days from creation.

//refresh() checks the token's existence, expiry, revocation status, and user account status.

//$transaction() ensures the old token is revoked and its replacement is stored together. If the old token has already been used, the second request is rejected.
