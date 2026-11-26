import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
  ForbiddenException,
  NotFoundException,
  NotImplementedException,
  Headers
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedRequest } from '../../auth/guards/jwt-auth.guard.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('quote')
  @Roles(UserRole.CUSTOMER)
  quote(@Body() _body: unknown): never {
    throw new NotImplementedException('Booking quote is not implemented yet');
  }

  
  @Post()
  @Roles(UserRole.CUSTOMER)
  createBooking(@Body() _body: unknown, @Headers('Idempotency-Key') _idempotencyKey: string): never {
    throw new NotImplementedException(
      'Booking creation/payment is not implemented yet',
    );
  }

  @Get()
  @Roles(UserRole.CUSTOMER)
  getMyBookings(@Query() _query: unknown): never {
    throw new NotImplementedException(
      'Customer booking history is not implemented yet',
    );
  }

  @Get(':reference/confirmation.pdf')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.CUSTOMER)
  async getConfirmation(
    @Param('reference') reference: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<never> {
    await this.assertBookingReadAccess(reference, request);
    throw new NotImplementedException(
      'Booking confirmation PDF is not implemented yet',
    );
  }

  @Get(':reference')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.CUSTOMER)
  async getBooking(
    @Param('reference') reference: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<never> {
    await this.assertBookingReadAccess(reference, request);
    throw new NotImplementedException('Booking detail is not implemented yet');
  }

  @Post(':reference/cancel')
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER)
  async cancelBooking(
    @Param('reference') reference: string,
    @Req() request: AuthenticatedRequest, 
    @Headers('Idempotency-Key') _idempotencyKey: string
  ): Promise<never> {
    const role = request.user.role;
    if (role !== UserRole.ADMIN && role !== UserRole.CUSTOMER) {
      throw new ForbiddenException('Forbidden');
    }

    const booking = await this.prisma.booking.findUnique({
      where: { reference },
      select: { customerId: true },
    });

    if (
      !booking ||
      (role === UserRole.CUSTOMER &&
        booking.customerId.toString() !== request.user.sub)
    ) {
      // SRS: do not reveal whether another customer's booking exists.
      throw new NotFoundException('Booking not found');
    }

    throw new NotImplementedException(
      'Booking cancellation/refund is not implemented yet',
    );
  }

  private async assertBookingReadAccess(
    reference: string,
    request: AuthenticatedRequest,
  ): Promise<void> {
    const role = request.user.role;
    if (
      ![UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.CUSTOMER].includes(role)
    ) {
      throw new ForbiddenException('Forbidden');
    }

    const booking = await this.prisma.booking.findUnique({
      where: { reference },
      select: { customerId: true },
    });

    if (
      !booking ||
      (role === UserRole.CUSTOMER &&
        booking.customerId.toString() !== request.user.sub)
    ) {
      // SRS: a customer must receive 404 for another customer's booking.
      throw new NotFoundException('Booking not found');
    }
  }
}
