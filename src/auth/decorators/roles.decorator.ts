import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

// Metadata key used to identify allowed roles.
export const ROLES_KEY = 'roles';

// Specifies which roles can access a route.
export const Roles = (...roles: UserRole[]) =>
  SetMetadata(ROLES_KEY, roles);

/*
@Roles(UserRole.ADMIN)
@Get('staff')
getStaff() {
  // ...
}
  This tells NestJS that only users with the ADMIN role should access that endpoint.

The decorator only defines the allowed roles. We'll create a separate RolesGuard to enforce those restrictions.

*/