import { Controller, Get, Param, Req, ForbiddenException, NotFoundException, NotImplementedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedRequest } from '../../auth/guards/jwt-auth.guard.js';
import { Roles } from '../../auth/decorators/roles.decorator.js';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':number.pdf')
  @Roles(UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.CUSTOMER)
  async getInvoice(
    @Param('number') number: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<never> {
    const role = request.user.role;
    if (![UserRole.ADMIN, UserRole.RECEPTIONIST, UserRole.CUSTOMER].includes(role)) {
      throw new ForbiddenException('Forbidden');
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { number },
      select: { booking: { select: { customerId: true } } },
    });

    if (!invoice || (role === UserRole.CUSTOMER && invoice.booking.customerId.toString() !== request.user.sub)) {
      throw new NotFoundException('Invoice not found');
    }

    throw new NotImplementedException('Invoice PDF generation is not implemented yet');
  }
}
