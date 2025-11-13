import { Module } from '@nestjs/common';
import { CotizacionesService } from './cotizaciones.service';
import { CotizacionesController } from './cotizaciones.controller';
import { PrismaService } from '@/infra/database/prisma.service';
import { RoleIdsGuard } from '@/modules/auth/guards/role-ids.guard';

@Module({
  controllers: [CotizacionesController],
  providers: [CotizacionesService, PrismaService, RoleIdsGuard],
  exports: [CotizacionesService],
})
export class CotizacionesModule {}
