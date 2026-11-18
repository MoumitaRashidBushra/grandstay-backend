//DTO means Data Transfer Object. It defines the structure and validation rules for incoming request data.

import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail() //Checks whether the email has a valid email format.
  email: string;

  @IsString() //Ensures the password is a string.
  @IsNotEmpty() //Prevents an empty password.
  password: string;
  //These validations happen before the request reaches our login service, provided we enable NestJS's ValidationPipe.
}
