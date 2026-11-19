import { Controller, Get, NotFoundException, Req } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedRequest } from '../../auth/guards/jwt-auth.guard.js';
/*AuthenticatedRequest is only used as a TypeScript type.
import type tells TypeScript that it doesn't need to import this as a runtime JavaScript value.
This satisfies the isolatedModules and emitDecoratorMetadata requirements.*/


@Controller('me')
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getProfile(@Req() request: AuthenticatedRequest) {
    const userId = BigInt(request.user.sub);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        email: true,
        mobile: true,
        role: true,
        mustResetPw: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      ...user,
      id: user.id.toString(),
    };
  }
}
