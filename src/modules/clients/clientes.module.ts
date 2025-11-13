import { Module } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { ClientesController } from './clientes.controller';
import { PrismaService } from '@/infra/database/prisma.service';
import { RoleIdsGuard } from '@/modules/auth/guards/role-ids.guard';

// Módulo que agrupa controller y service de Clientes
@Module({
  controllers: [ClientesController],
  providers: [ClientesService, PrismaService, RoleIdsGuard],
  exports: [ClientesService],
})
export class ClientesModule {}
