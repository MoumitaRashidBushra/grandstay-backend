import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, UseGuards } from '@nestjs/common';
import type { User } from '@prisma/client';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { validatedBody } from './validated-body.pipe.js';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  getProfile(@CurrentUser() user: User) {
    return this.authService.getProfile(user.id);
  }

  @Patch()
  updateProfile(
    @CurrentUser() user: User,
    @Body(validatedBody(UpdateProfileDto)) dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(user.id, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('password')
  changePassword(
    @CurrentUser() user: User,
    @Body(validatedBody(ChangePasswordDto)) dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }
}
