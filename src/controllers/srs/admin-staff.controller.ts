import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthenticatedRequest } from '../../auth/guards/jwt-auth.guard.js';
import {
  CreateStaffDto,
  ListStaffQueryDto,
  UpdateStaffDto,
} from '../../dto/staff.dto.js';
import { StaffService } from '../../services/staff/staff.service.js';

@Controller('admin/staff')
@Roles(UserRole.ADMIN)
export class AdminStaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  listStaff(@Query() query: ListStaffQueryDto) {
    return this.staffService.list(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createStaff(@Body() body: CreateStaffDto) {
    return this.staffService.create(body);
  }

  @Patch(':id')
  updateStaff(
    @Param('id') id: string,
    @Body() body: UpdateStaffDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.staffService.update(id, body, request.user.sub);
  }
}
