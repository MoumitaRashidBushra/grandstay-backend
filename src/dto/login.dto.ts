//DTO means Data Transfer Object. It defines the structure and validation rules for incoming request data.

import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  // Trim before the format check so "  Rahim@Example.com  " reaches the same account.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail() //Checks whether the email has a valid email format.
  email: string;

  @IsString() //Ensures the password is a string.
  @IsNotEmpty() //Prevents an empty password.
  password: string;
  //These validations happen before the request reaches our login service, provided we enable NestJS's ValidationPipe.
}
