import { DocumentBuilder } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('UNIQUOTE API')
  .setDescription('Endpoints')
  .setVersion('1.0')
  .addBearerAuth()
  .build();
