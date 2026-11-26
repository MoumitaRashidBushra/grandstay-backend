import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Req,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { AllowDuringPasswordReset } from '../../auth/decorators/allow-during-password-reset.decorator.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthenticatedRequest } from '../../auth/guards/jwt-auth.guard.js';
import { ChangePasswordDto } from '../../dto/change-password.dto.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthService } from '../../services/auth/auth.service.js';
/*AuthenticatedRequest is only used as a TypeScript type.
import type tells TypeScript that it doesn't need to import this as a runtime JavaScript value.
This satisfies the isolatedModules and emitDecoratorMetadata requirements.*/

@Controller('me')
export class MeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  @AllowDuringPasswordReset()
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.CUSTOMER)
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

  @Post('password')
  @HttpCode(HttpStatus.OK)
  @AllowDuringPasswordReset()
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.CUSTOMER)
  changePassword(
    @Req() request: AuthenticatedRequest,
    @Body() body: ChangePasswordDto,
  ) {
    return this.authService.changePassword(request.user.sub, body);
  }
}
