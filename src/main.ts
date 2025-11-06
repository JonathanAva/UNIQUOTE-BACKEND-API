import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {DocumentBuilder,SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';
import { swaggerConfig } from './config/swagger.config';
import { Logger as PinoLogger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';





async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // importante para usar Pino correctamente
  });

  // 🔐 CORS: habilita CORS para que el frontend (Angular) pueda acceder
  app.enableCors({
    origin: [
      'http://localhost:4200',      // dev
      'https://app.tu-dominio.com', // prod
    ],
    credentials: true,
    methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','X-XSRF-TOKEN'],
  });


  app.useLogger(app.get(PinoLogger));


  app.use(cookieParser());
  app.setGlobalPrefix('api/v1');

  // 📦 Validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

if (process.env.NODE_ENV !== 'production') {
  const config = new DocumentBuilder()
    .setTitle('Uniquote API')
    .setDescription('Documentación de endpoints')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, doc, {
    swaggerOptions: { persistAuthorization: true },
  });
}

  const port = process.env.PORT || 3000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`📚 Documentación Swagger: http://localhost:${port}/api`);
}
bootstrap();
