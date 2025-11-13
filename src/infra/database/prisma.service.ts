import { Injectable, OnModuleInit, INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Servicio Prisma que extiende PrismaClient para integrarse con NestJS
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  // Se ejecuta cuando el módulo que usa este servicio se inicializa
  async onModuleInit() {
    // Abre la conexión a la base de datos
    await this.$connect();
  }

  // Maneja el apagado controlado de la app para cerrar la conexión de Prisma
  async enableShutdownHooks(app: INestApplication) {
    (this as any).$on('beforeExit', async () => {
      await app.close();
    });
  }
}
