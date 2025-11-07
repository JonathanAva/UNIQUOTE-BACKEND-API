import { DocumentBuilder } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('UNIQUOTE API')
  .setDescription('Documentación de los endpoints')
  .setVersion('2.0')
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      in: 'header',
      name: 'Authorization',
    },
    'jwt',
  )
  .build();
