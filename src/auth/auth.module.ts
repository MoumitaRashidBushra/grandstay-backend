import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';//provides the JwtService used to sign access tokens.
import { ThrottlerModule } from '@nestjs/throttler';

import { AuthController } from '../controllers/auth/auth.controller.js';//exposes the login endpoint.
import { AuthService } from '../services/auth/auth.service.js';//contains the login business logic.
import { PrismaModule } from '../prisma/prisma.module.js';//gives AuthService access to the database.

import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';

const jwtSecret = process.env.JWT_ACCESS_SECRET; //The JWT secret is read from an environment variable. We deliberately don't use a hardcoded fallback secret.

if (!jwtSecret) {
  throw new Error('JWT_ACCESS_SECRET environment variable is required');
}

@Module({
  imports: [
    PrismaModule,
    ThrottlerModule.forRoot([
    {
      ttl: 60_000,//a 60-second time window
      limit: 10,//a maximum of 10 requests during that window.
    },
  ]),
    JwtModule.register({
      secret: jwtSecret,
      signOptions: {
        expiresIn: '15m',
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, 
    // Authenticate users before checking their roles.
  {
    provide: APP_GUARD,
    useClass: JwtAuthGuard,
  },
  {
    provide: APP_GUARD,
    useClass: RolesGuard,
  },],  
  exports: [AuthService],
})
export class AuthModule {}
