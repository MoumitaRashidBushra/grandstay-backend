import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';

import { PrismaClient } from '@prisma/client';//PrismaClient: Provides methods to communicate with PostgreSQL, such as prisma.user.findUnique().

@Injectable()//@Injectable(): Tells NestJS that this class can be injected into other classes.
export class PrismaService
  extends PrismaClient//we're extending PrismaClient. This means PrismaService inherits all the Prisma database methods.
  //OnModuleInit: Runs when the NestJS module initializes.
  //OnModuleDestroy: Runs when the application shuts down.
  implements OnModuleInit, OnModuleDestroy
{
    //onModuleInit(): Establishes the database connection when the application starts.
  async onModuleInit() {
    await this.$connect();
  }
  //onModuleDestroy(): Closes the database connection cleanly.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}