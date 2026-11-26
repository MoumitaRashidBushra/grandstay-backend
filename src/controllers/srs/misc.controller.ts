import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator.js';
import { RegisterDto } from '../../dto/register.dto.js';
import { AuthService } from '../../services/auth/auth.service.js';

@Controller('auth')
export class RegistrationSkeletonController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
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
