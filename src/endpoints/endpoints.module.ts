import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import {
  AdminReportsController,
  AdminRoomsController,
} from '../controllers/srs/admin.controller.js';
import { AdminStaffController } from '../controllers/srs/admin-staff.controller.js';
import { StaffService } from '../services/staff/staff.service.js';
import {
  AvailabilityController,
  CategoriesController,
  SettingsController,
} from '../controllers/srs/public-catalog.controller.js';
import { BookingsController } from '../controllers/srs/bookings.controller.js';
import { DeskController } from '../controllers/srs/desk.controller.js';
import { InvoicesController } from '../controllers/srs/invoices.controller.js';
import {
  HealthSkeletonController,
  MePasswordSkeletonController,
  RegistrationSkeletonController,
} from '../controllers/srs/misc.controller.js';

@Module({
  imports: [PrismaModule],
  providers: [StaffService],
  controllers: [
    SettingsController,
    CategoriesController,
    AvailabilityController,
    AdminStaffController,
    AdminRoomsController,
    AdminReportsController,
    DeskController,
    BookingsController,
    InvoicesController,
    RegistrationSkeletonController,
    MePasswordSkeletonController,
    HealthSkeletonController,
  ],
})
export class SrsEndpointsModule {}
