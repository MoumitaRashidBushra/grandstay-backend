import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsEmail,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const MOBILE_PATTERN = /^01[3-9]\d{8}$/;

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeEmail({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

export class RegisterDto {
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

  @IsOptional()
  @IsString()
  role?: string;
}
