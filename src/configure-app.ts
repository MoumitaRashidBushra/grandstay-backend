import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { validationException } from './auth/validated-body.pipe.js';

// Shared by the HTTP server and the API tests so both expose the same routes.
export function configureApp(app: INestApplication): void {
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: validationException,
    }),
  );
  app.setGlobalPrefix('api/v1');
}
