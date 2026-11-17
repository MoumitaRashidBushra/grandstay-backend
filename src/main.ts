import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import { configureApp } from './configure-app.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  configureApp(app);

  app.enableCors({
    origin:'http://localhost:5173',
    credentials: true,
  })
//app.listen() starts accepting HTTP requests.
  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
