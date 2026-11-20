import { Controller, Get, Param, Post, Query, NotImplementedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator.js';

@Controller('desk')
@Roles(UserRole.ADMIN, UserRole.RECEPTIONIST)
export class DeskController {
  @Get('bookings')
  findBookings(@Query('q') _query?: string): never {
    throw new NotImplementedException('Front-desk booking search is not implemented yet');
  }

  @Get('arrivals')
  getArrivals(@Query('date') _date?: string): never {
    throw new NotImplementedException('Daily arrivals are not implemented yet');
  }

  @Get('departures')
  getDepartures(@Query('date') _date?: string): never {
    throw new NotImplementedException('Daily departures are not implemented yet');
  }

  @Post('bookings/:reference/check-in')
  checkIn(@Param('reference') _reference: string): never {
    throw new NotImplementedException('Booking check-in is not implemented yet');
  }

  @Post('bookings/:reference/check-out')
  checkOut(@Param('reference') _reference: string): never {
    throw new NotImplementedException('Booking check-out is not implemented yet');
  }
}
