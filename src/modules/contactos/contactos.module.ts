import { Module } from '@nestjs/common';
import { ContactosService } from './contactos.service';
import { ContactosController } from './contactos.controller';
import { PrismaService } from '@/infra/database/prisma.service';
import { RoleIdsGuard } from '@/modules/auth/guards/role-ids.guard';
import { AuditoriaModule } from '@/modules/auditoria/auditoria.module';

// Módulo de Contactos (contactos de empresas clientes)
@Module({
  imports: [AuditoriaModule],
  controllers: [ContactosController],
  providers: [ContactosService, PrismaService, RoleIdsGuard],
})
export class ContactosModule {}
