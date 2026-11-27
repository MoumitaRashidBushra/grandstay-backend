import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotImplementedException,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { Roles } from '../../auth/decorators/roles.decorator.js';
import type { AuthenticatedRequest } from '../../auth/guards/jwt-auth.guard.js';
import { isEmptyBody } from '../../auth/validated-body.pipe.js';
import { CreateStaffDto, UpdateStaffDto } from '../../dto/staff.dto.js';
import { StaffService } from '../../services/staff/staff.service.js';

@Controller('admin/staff')
@Roles(UserRole.ADMIN)
export class AdminStaffController {
  constructor(private readonly staffService: StaffService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createStaff(@Body() body: Record<string, unknown>) {
    if (isEmptyBody(body)) {
      throw new NotImplementedException('Staff creation is not implemented yet');
    }
    return this.staffService.create(body as unknown as CreateStaffDto);
  }

  @Patch(':id')
  updateStaff(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() request: AuthenticatedRequest,
  ) {
    if (isEmptyBody(body)) {
      throw new NotImplementedException('Staff update is not implemented yet');
    }
    return this.staffService.update(
      id,
      body as unknown as UpdateStaffDto,
      request.user.sub,
    );
  }
}
