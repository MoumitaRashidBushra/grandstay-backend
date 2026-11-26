// Nest building blocks: guard interface, request context, class decorator, 401 error.
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

// Reads metadata (like @Public()) that was set on a route or controller.
import { Reflector } from '@nestjs/core';

// Verifies the JWT signature and expiry.
import { JwtService } from '@nestjs/jwt';

// Type of the incoming HTTP request.
import { Request } from 'express';

// Role enum generated from our Prisma schema (ADMIN, RECEPTIONIST, CUSTOMER).
import { UserRole } from '@prisma/client';

//connect the @Public() decorator to your JWT guard
import { ALLOW_DURING_PASSWORD_RESET_KEY } from '../decorators/allow-during-password-reset.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';

// Data we store inside the access token.
export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

// An Express request that also carries the logged-in user.
export interface AuthenticatedRequest extends Request {
  user: AccessTokenPayload;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  // Runs before every route. Returns true to allow, throws 401 to block.
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Routes marked @Public() (like login) skip the token check.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [//The decorator and JWT guard now use the same metadata key. When a route has @Public(), the JWT guard recognizes it and skips authentication.
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    // 2. Get the token from the Authorization header.
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.getToken(request);
    if (!token) {
      throw new UnauthorizedException('Unauthorized');
    }

    // 3. Verify signature and expiry. Any failure becomes a 401.
    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch {
      throw new UnauthorizedException('Unauthorized');
    }

    // 4. Make sure the token has the user info we need.
    if (!payload.sub || !payload.email || !payload.role) {
      throw new UnauthorizedException('Unauthorized');
    }

    let account: {
      id: bigint;
      email: string;
      role: UserRole;
      isActive: boolean;
      mustResetPw: boolean;
    } | null;

    try {
      account = await this.prisma.user.findUnique({
        where: { id: BigInt(payload.sub) },
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          mustResetPw: true,
        },
      });
    } catch {
      throw new UnauthorizedException('Unauthorized');
    }

    if (!account || !account.isActive) {
      throw new UnauthorizedException('Unauthorized');
    }

    request.user = {
      sub: account.id.toString(),
      email: account.email,
      role: account.role,
    };

    if (account.mustResetPw) {
      const passwordChangeAllowed = this.reflector.getAllAndOverride<boolean>(
        ALLOW_DURING_PASSWORD_RESET_KEY,
        [context.getHandler(), context.getClass()],
      );

      if (!passwordChangeAllowed) {
        throw new ForbiddenException({
          statusCode: 403,
          code: 'PASSWORD_RESET_REQUIRED',
          message: 'Set a new password before continuing.',
        });
      }
    }

    return true;
  }

  // Returns the token from "Authorization: Bearer <token>", or undefined if missing.
  private getToken(request: Request): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      return undefined;
    }

    return token;
  }
}
