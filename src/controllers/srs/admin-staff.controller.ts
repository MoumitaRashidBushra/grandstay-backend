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
import { ResetPasswordDto } from '../../dto/reset-password.dto.js';
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

  @Post(':id/reset-password')
  resetStaffPassword(
    @Param('id') id: string,
    @Body() body: ResetPasswordDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.staffService.resetTemporaryPassword(
      id,
      body.password,
      request.user.sub,
    );
  }
}

@Controller('admin/customers')
@Roles(UserRole.ADMIN)
export class AdminCustomersController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  listCustomers(@Query() query: ListStaffQueryDto) {
    return this.staffService.listCustomers(query);
  }

  @Patch(':id')
  updateCustomer(
    @Param('id') id: string,
    @Body() body: UpdateStaffDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.staffService.updateCustomer(id, body, request.user.sub);
  }

  @Post(':id/reset-password')
  resetCustomerPassword(
    @Param('id') id: string,
    @Body() body: ResetPasswordDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.staffService.resetTemporaryPassword(
      id,
      body.password,
      request.user.sub,
    );
  }
}
