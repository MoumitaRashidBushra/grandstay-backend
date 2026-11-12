import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Module({
  providers: [PrismaService],
  exports: [PrismaService],//Because other modules, such as our upcoming AuthModule, need to access it.
})
export class PrismaModule {}