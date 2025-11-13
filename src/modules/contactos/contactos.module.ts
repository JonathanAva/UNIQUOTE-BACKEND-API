import { Module } from '@nestjs/common';
import { ContactosService } from './contactos.service';
import { ContactosController } from './contactos.controller';
import { PrismaService } from '@/infra/database/prisma.service';
import { RoleIdsGuard } from '@/modules/auth/guards/role-ids.guard';

// Módulo de Contactos (contactos de empresas clientes)
@Module({
  controllers: [ContactosController],
  providers: [ContactosService, PrismaService, RoleIdsGuard],
})
export class ContactosModule {}
