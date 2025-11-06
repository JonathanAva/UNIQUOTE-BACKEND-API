import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';
import { swaggerConfig } from './config/swagger.config';
import { Logger as PinoLogger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // CORS (dev) permitiendo Authorization
  app.enableCors({
    origin: ['http://localhost:4200', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  });

  app.useLogger(app.get(PinoLogger));
  app.use(cookieParser());

  // Prefijo global
  app.setGlobalPrefix('api/v1');

  // Validación global
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Swagger con el esquema "jwt" y respetando el prefijo global
  if (process.env.NODE_ENV !== 'production') {
    const document = SwaggerModule.createDocument(app, swaggerConfig, {
      ignoreGlobalPrefix: false,
    });

    SwaggerModule.setup('api', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);

  new Logger('Bootstrap').log(`📚 Swagger: http://localhost:${port}/api`);
}
bootstrap();
