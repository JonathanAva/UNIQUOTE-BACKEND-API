// src/modules/clientes/clientes.module.ts
import { Module } from '@nestjs/common';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';
import { PrismaService } from '@/infra/database/prisma.service';
import { AuditoriaModule } from '@/modules/auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [ClientesController],
  providers: [ClientesService, PrismaService],
  exports: [ClientesService],
})
export class ClientesModule {}
