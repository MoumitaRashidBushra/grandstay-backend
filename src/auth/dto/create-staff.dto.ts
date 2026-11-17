import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MESSAGE, PASSWORD_PATTERN } from '../password.js';

export class CreateStaffDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  fullName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @Matches(/^01[3-9][0-9]{8}$/)
  mobile?: string;

  @IsString()
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  password: string;
}
