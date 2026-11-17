import { Body, Controller, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service.js';
import { CreateStaffDto } from './dto/create-staff.dto.js';
import { UpdateStaffDto } from './dto/update-staff.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { Roles } from './roles.decorator.js';
import { RolesGuard } from './roles.guard.js';
import { validatedBody } from './validated-body.pipe.js';

@Controller('admin/staff')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class StaffController {
  constructor(private readonly authService: AuthService) {}

  @Post()
  create(@Body(validatedBody(CreateStaffDto)) dto: CreateStaffDto) {
    return this.authService.createReceptionist(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(validatedBody(UpdateStaffDto)) dto: UpdateStaffDto,
  ) {
    return this.authService.updateReceptionist(id, dto);
  }
}
