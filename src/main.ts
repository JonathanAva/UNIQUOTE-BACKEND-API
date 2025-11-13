import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';
import { swaggerConfig } from './config/swagger.config';
import { Logger as PinoLogger } from 'nestjs-pino';
import cookieParser from 'cookie-parser';

// Punto de entrada principal de la aplicación NestJS
async function bootstrap() {
  // Crea la app con soporte de logs bufferizados (para pino)
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Configuración de CORS (entorno dev) permitiendo Authorization
  app.enableCors({
    origin: ['http://localhost:4200', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  });

  // Se usa el logger de pino integrado
  app.useLogger(app.get(PinoLogger));
  // Middleware para parsear cookies en requests
  app.use(cookieParser());

  // Prefijo global para todos los endpoints (api/v1/...)
  app.setGlobalPrefix('api/v1');

  // Validación global de DTOs
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,            // ignora propiedades no definidas en DTO
    forbidNonWhitelisted: true, // lanza error si vienen propiedades extra
    transform: true,            // transforma tipos (por ejemplo string -> number)
  }));

  // Configura Swagger solo en entornos no productivos
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
