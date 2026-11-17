import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { PASSWORD_MESSAGE, PASSWORD_PATTERN } from '../password.js';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  newPassword: string;
}
