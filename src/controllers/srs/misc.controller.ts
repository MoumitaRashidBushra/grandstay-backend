import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotImplementedException,
  Post,
} from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator.js';
import { isEmptyBody } from '../../auth/validated-body.pipe.js';
import { RegisterDto } from '../../dto/register.dto.js';
import { AuthService } from '../../services/auth/auth.service.js';

@Controller('auth')
export class RegistrationSkeletonController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() body: Record<string, unknown>) {
    if (isEmptyBody(body)) {
      throw new NotImplementedException('Registration is not implemented yet');
    }
    return this.authService.register(body as unknown as RegisterDto);
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
