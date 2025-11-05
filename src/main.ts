import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';
import { swaggerConfig } from './config/swagger.config';
import { Logger as PinoLogger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // importante para usar Pino correctamente
  });

  // 🔐 CORS: habilita CORS para que el frontend (Angular) pueda acceder
  app.enableCors({
    origin: '*', // o usa una whitelist si prefieres más control
  });

  // ✅ Logger empresarial (Pino)
  app.useLogger(app.get(PinoLogger));

  // 🔍 Prefijo global para todas las rutas
  app.setGlobalPrefix('api/v1');

  // 📦 Validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 📚 Swagger solo en entorno local/dev
  if (process.env.NODE_ENV !== 'production') {
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`📚 Documentación Swagger: http://localhost:${port}/api`);
}
bootstrap();
