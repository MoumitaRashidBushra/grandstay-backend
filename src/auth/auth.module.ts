import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';//provides the JwtService used to sign access tokens.

import { AuthController } from './auth.controller.js';//exposes the login endpoint.
import { AuthService } from './auth.service.js';//contains the login business logic.
import { PrismaModule } from '../prisma/prisma.module.js';//gives AuthService access to the database.

const jwtSecret = process.env.JWT_ACCESS_SECRET;//The JWT secret is read from an environment variable. We deliberately don't use a hardcoded fallback secret.

if (!jwtSecret) {
  throw new Error('JWT_ACCESS_SECRET environment variable is required');
}

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: jwtSecret,
      signOptions: {
        expiresIn: '15m',
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
