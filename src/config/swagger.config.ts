import { DocumentBuilder } from '@nestjs/swagger';

// Configuración base para la documentación Swagger de la API
export const swaggerConfig = new DocumentBuilder()
  .setTitle('UNIQUOTE API') // Título visible en Swagger UI
  .setDescription('Documentación de los endpoints') // Descripción general
  .setVersion('2.0') // Versión de la API
  // Definición del esquema de seguridad tipo Bearer JWT
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      in: 'header',
      name: 'Authorization',
    },
    'jwt', // nombre del esquema, se usa en @ApiBearerAuth('jwt')
  )
  .build();
