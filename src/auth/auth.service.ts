import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

import { PrismaService } from '../prisma/prisma.service.js';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const email = loginDto.email.trim().toLowerCase();

    // 1. Find the user by email.
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    // 2. Return the same error for unknown email and wrong password.
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 3. Reject inactive accounts.
    if (!user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 4. Verify the submitted password against the stored Argon2id hash.
    let passwordIsValid = false;

    try {
      passwordIsValid = await argon2.verify(
        user.passwordHash,//the hash stored in PostgreSQL.
        loginDto.password,//the plain-text password submitted by the user.
      );
    } catch {
      passwordIsValid = false;
    }

    if (!passwordIsValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // 5. Generate the access token.
    const accessToken = await this.jwtService.signAsync({
      sub: user.id.toString(),//sub: User ID (the standard JWT subject claim)
      email: user.email,//email: User's email
      role: user.role,//role: ADMIN, RECEPTIONIST or CUSTOMER
    });

    // 6. Return the token and safe user information.
    return {
      accessToken,
      user: {
        id: user.id.toString(),
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        mustResetPw: user.mustResetPw,//SRS requires newly created receptionists with temporary passwords to change their passwords at first login (FR-AUTH-03). Returning this flag allows the frontend to handle that requirement later.
      },
    };
  }
}
