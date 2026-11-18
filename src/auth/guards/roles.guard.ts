import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { AuthenticatedRequest } from './jwt-auth.guard.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Get the roles allowed to access this route.
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles are specified, allow access (JWT authentication
    // is still handled by JwtAuthGuard).
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Get the authenticated user added by JwtAuthGuard.
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    // Block access if the user's role is not permitted.
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Forbidden');
    }

    return true;
  }
}

/*- @Roles(UserRole.ADMIN) provides the allowed roles.
- RolesGuard reads those roles using Reflector.
- If the user's role is allowed, the request continues.
- If the user's role is not allowed, NestJS returns 403 Forbidden.
Important: RolesGuard depends on JwtAuthGuard running first, so the user is attached to the request before role checking. */