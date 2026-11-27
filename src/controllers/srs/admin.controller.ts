import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  NotImplementedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator.js';

@Controller('admin/rooms')
@Roles(UserRole.ADMIN)
export class AdminRoomsController {
  @Get()
  listRooms(@Query() _query: unknown): never {
    throw new NotImplementedException('Room listing is not implemented yet');
  }

  @Get(':id')
  getRoom(@Param('id') _id: string): never {
    throw new NotImplementedException('Room detail is not implemented yet');
  }

  @Post()
  createRoom(@Body() _body: unknown): never {
    throw new NotImplementedException('Room creation is not implemented yet');
  }

  @Patch(':id')
  updateRoom(@Param('id') _id: string, @Body() _body: unknown): never {
    throw new NotImplementedException('Room update is not implemented yet');
  }

  @Delete(':id')
  deleteRoom(@Param('id') _id: string): never {
    throw new NotImplementedException('Room deletion is not implemented yet');
  }

  @Post(':id/status')
  updateRoomStatus(@Param('id') _id: string, @Body() _body: unknown): never {
    throw new NotImplementedException(
      'Room maintenance/status operation is not implemented yet',
    );
  }
}

@Controller('admin')
@Roles(UserRole.ADMIN)
export class AdminReportsController {
  @Get('reservations')
  getReservations(@Query() _query: unknown): never {
    throw new NotImplementedException(
      'Admin reservation filters are not implemented yet',
    );
  }

  @Get('dashboard')
  getDashboard(@Query() _query: unknown): never {
    throw new NotImplementedException('Admin dashboard is not implemented yet');
  }
}
