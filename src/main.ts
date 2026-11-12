import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
//NestFactory.create() creates your NestJS application
//app.useGlobalPipes() registers validation for incoming requests. Applies validation to incoming requests across the application.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Removes properties not defined in the DTO.
      transform: true, // Transforms incoming objects into DTO instances.
    }),
  );
  app.setGlobalPrefix('api/v1');//Adds /api/v1 before every controller route.
//app.listen() starts accepting HTTP requests.
  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
