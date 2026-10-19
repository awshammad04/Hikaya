import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { internalAccess, requireProductionConfig } from './production';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  requireProductionConfig();
  app.use(internalAccess);
  app.enableShutdownHooks();

  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? false
        : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();
