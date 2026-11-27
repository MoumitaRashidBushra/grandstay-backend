import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  Put,
  Query,
  NotImplementedException,
} from '@nestjs/common';

import { Public } from '../../auth/decorators/public.decorator.js';
import { UserRole } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator.js';

@Controller('settings')
export class SettingsController {
  @Public()
  @Get()
  getSettings() {
    return {
      message: 'Hotel settings endpoint skeleton',
      access: 'public',
    };
  }

  @Put()
  @Roles(UserRole.ADMIN)
  updateSettings(@Body() _body: unknown): never {
    throw new NotImplementedException('Settings update is not implemented yet');
  }
}

@Controller('categories')
export class CategoriesController {
  @Public()
  @Get()
  getCategories() {
    return {
      message: 'Categories list endpoint skeleton',
      access: 'public',
    };
  }

  @Public()
  @Get(':id')
  getCategory(@Param('id') _id: string) {
    return {
      message: 'Category detail endpoint skeleton',
      access: 'public',
    };
  }

  @Patch()
  @Roles(UserRole.ADMIN)
  updateCategory(@Body() _body: unknown): never {
    throw new NotImplementedException('Category update is not implemented yet');
  }
}

@Controller('availability')
export class AvailabilityController {
  @Public()
  @Get()
  getAvailability(
    @Query()
    query: {
      checkIn?: string;
      checkOut?: string;
      guests?: string;
    },
  ) {
    return {
      message: 'Availability search endpoint skeleton',
      access: 'public',
      query,
    };
  }
}
