import { Controller, Get, Post, Body, NotImplementedException } from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator.js';
import { UserRole } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator.js';


@Controller('auth')
export class RegistrationSkeletonController {
  @Public()
  @Post('register')
  register(@Body() _body: unknown): never {
    throw new NotImplementedException('Customer registration is not implemented yet');
  }
}

@Controller('me')
export class MePasswordSkeletonController {
  @Post('password')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.CUSTOMER)
  changePassword(@Body() _body: unknown): never {
    throw new NotImplementedException('Password change is not implemented yet');
  }
}

@Controller()
export class HealthSkeletonController {
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', endpoint: 'health', note: 'Skeleton health response' };
  }

  @Public()
  @Get('ready')
  ready() {
    return { status: 'ok', endpoint: 'ready', note: 'Skeleton readiness response' };
  }
}
