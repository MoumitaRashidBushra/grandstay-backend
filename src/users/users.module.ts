import { Module } from '@nestjs/common';
import { MeController } from '../controllers/users/me.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [MeController],
})
export class UsersModule {}