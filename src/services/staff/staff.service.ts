import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole, type Prisma } from '@prisma/client';
import * as argon2 from 'argon2';

import {
  type CreateStaffDto,
  type ListStaffQueryDto,
  type UpdateStaffDto,
} from '../../dto/staff.dto.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const STAFF_ROLES = [UserRole.ADMIN, UserRole.RECEPTIONIST];

const staffSelect = {
  id: true,
  fullName: true,
  email: true,
  mobile: true,
  role: true,
  isActive: true,
  mustResetPw: true,
  createdAt: true,
} as const;

type StaffRecord = Prisma.UserGetPayload<{ select: typeof staffSelect }>;

export interface StaffAccount {
  id: string;
  fullName: string;
  email: string;
  mobile: string | null;
  role: UserRole;
  isActive: boolean;
  mustResetPw: boolean;
  createdAt: string;
}

function toStaffAccount(user: StaffRecord): StaffAccount {
  return {
    id: user.id.toString(),
    fullName: user.fullName,
    email: user.email,
    mobile: user.mobile?.trim() ?? null,
    role: user.role,
    isActive: user.isActive,
    mustResetPw: user.mustResetPw,
    createdAt: user.createdAt.toISOString(),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  );
}

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListStaffQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      role: query.role ?? { in: STAFF_ROLES },
    };

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [staff, roster] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: staffSelect,
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.user.findMany({
        where: { role: { in: STAFF_ROLES } },
        select: { role: true, isActive: true },
      }),
    ]);

    return {
      staff: staff.map(toStaffAccount),
      summary: {
        total: roster.length,
        admins: roster.filter((user) => user.role === UserRole.ADMIN).length,
        receptionists: roster.filter(
          (user) => user.role === UserRole.RECEPTIONIST,
        ).length,
        active: roster.filter((user) => user.isActive).length,
      },
    };
  }

  async create(dto: CreateStaffDto): Promise<StaffAccount> {
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    try {
      const user = await this.prisma.user.create({
        data: {
          fullName: dto.fullName.trim(),
          email: dto.email.trim().toLowerCase(),
          mobile: dto.mobile,
          passwordHash,
          role: UserRole.RECEPTIONIST,
          isActive: true,
          mustResetPw: true,
        },
        select: staffSelect,
      });

      return toStaffAccount(user);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('A user with this email already exists');
      }

      throw error;
    }
  }

  update(id: string, dto: UpdateStaffDto, actorId: string) {
    return this.updateAccount(id, dto, actorId, [
      UserRole.ADMIN,
      UserRole.RECEPTIONIST,
    ]);
  }

  private async applyUpdate(
    existing: StaffRecord,
    dto: UpdateStaffDto,
    actorId: string,
  ): Promise<StaffAccount> {
    const changesOwnStatus =
      actorId === existing.id.toString() &&
      dto.isActive !== undefined &&
      dto.isActive !== existing.isActive;

    if (changesOwnStatus) {
      throw new ForbiddenException(
        'You cannot change your own account status',
      );
    }

    const nextActive = dto.isActive ?? existing.isActive;
    const removesLastAdmin =
      existing.role === UserRole.ADMIN &&
      existing.isActive &&
      !nextActive;

    if (removesLastAdmin) {
      const otherActiveAdmins = await this.prisma.user.count({
        where: {
          role: UserRole.ADMIN,
          isActive: true,
          id: { not: existing.id },
        },
      });

      if (otherActiveAdmins === 0) {
        throw new ForbiddenException(
          'At least one active administrator is required',
        );
      }
    }

    const accessChanged = dto.isActive === false && existing.isActive;

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id: existing.id },
          data: {
            ...(dto.fullName !== undefined
              ? { fullName: dto.fullName.trim() }
              : {}),
            ...(dto.email !== undefined
              ? { email: dto.email.trim().toLowerCase() }
              : {}),
            ...(dto.mobile !== undefined ? { mobile: dto.mobile } : {}),
            ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          },
          select: staffSelect,
        });

        if (accessChanged) {
          await tx.refreshToken.updateMany({
            where: { userId: existing.id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }

        return user;
      });

      return toStaffAccount(updated);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('A user with this email already exists');
      }

      throw error;
    }
  }

  async listCustomers(query: ListStaffQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = { role: UserRole.CUSTOMER };

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [customers, roster] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: staffSelect,
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.user.findMany({
        where: { role: UserRole.CUSTOMER },
        select: { isActive: true },
      }),
    ]);

    return {
      customers: customers.map(toStaffAccount),
      summary: {
        total: roster.length,
        active: roster.filter((user) => user.isActive).length,
      },
    };
  }

  updateCustomer(id: string, dto: UpdateStaffDto, actorId: string) {
    return this.updateAccount(id, dto, actorId, [UserRole.CUSTOMER]);
  }

  async resetTemporaryPassword(id: string, password: string, actorId: string) {
    const userId = this.parseId(id);
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: staffSelect,
    });

    // Staff means ADMIN and RECEPTIONIST (D12). Admin may also reset customers (D4).
    if (
      !existing ||
      (existing.role !== UserRole.ADMIN &&
        existing.role !== UserRole.RECEPTIONIST &&
        existing.role !== UserRole.CUSTOMER)
    ) {
      throw new NotFoundException('Account not found');
    }

    if (actorId === existing.id.toString()) {
      throw new ForbiddenException(
        'Change your own password from your profile',
      );
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          mustResetPw: true,
        },
        select: staffSelect,
      });

      await tx.refreshToken.updateMany({
        where: { userId: existing.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      return user;
    });

    return toStaffAccount(updated);
  }

  private async updateAccount(
    id: string,
    dto: UpdateStaffDto,
    actorId: string,
    allowedRoles: UserRole[],
  ): Promise<StaffAccount> {
    const userId = this.parseId(id);

    if (!this.hasChanges(dto)) {
      throw new BadRequestException('No changes were provided');
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: staffSelect,
    });

    if (!existing || !allowedRoles.includes(existing.role)) {
      throw new NotFoundException('Account not found');
    }

    return this.applyUpdate(existing, dto, actorId);
  }

  private parseId(id: string): bigint {
    if (!/^\d+$/.test(id)) {
      throw new BadRequestException('Staff id must be a number');
    }

    return BigInt(id);
  }

  private hasChanges(dto: UpdateStaffDto): boolean {
    return (
      dto.fullName !== undefined ||
      dto.email !== undefined ||
      dto.mobile !== undefined ||
      dto.isActive !== undefined
    );
  }
}
