import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export const STAFF_ROLES = [UserRole.ADMIN, UserRole.RECEPTIONIST] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

const MOBILE_PATTERN = /^01[3-9]\d{8}$/;

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeEmail({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export class CreateStaffDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  fullName!: string;

  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @Matches(MOBILE_PATTERN, {
    message: 'mobile must be an 11-digit Bangladeshi mobile number',
  })
  mobile!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}

export class UpdateStaffDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @Matches(MOBILE_PATTERN, {
    message: 'mobile must be an 11-digit Bangladeshi mobile number',
  })
  mobile?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListStaffQueryDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn(STAFF_ROLES)
  role?: StaffRole;
}
