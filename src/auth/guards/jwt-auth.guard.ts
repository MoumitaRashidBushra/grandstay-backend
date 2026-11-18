// Nest building blocks: guard interface, request context, class decorator, 401 error.
import {
  CanActivate,
  ExecutionContext,
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
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

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

    // 5. Save the user on the request so controllers and the role guard can use it.
    request.user = payload;
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
