import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MESSAGE, PASSWORD_PATTERN } from '../password.js';

export class RegisterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  fullName: string;

  @IsEmail()
  email: string;

  @Matches(/^01[3-9][0-9]{8}$/)
  mobile: string;

  @IsString()
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  password: string;

  // Accepted so a staff role can be rejected with 422. Customers omit it.
  @IsOptional()
  @IsIn(['CUSTOMER', 'RECEPTIONIST', 'ADMIN'])
  role?: 'CUSTOMER' | 'RECEPTIONIST' | 'ADMIN';
}
