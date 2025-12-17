// src/modules/constantes/constantes.module.ts
import { Module } from '@nestjs/common';
import { ConstantesService } from './constantes.service';
import { ConstantesController } from './constantes.controller';
import { PrismaService } from '@/infra/database/prisma.service';
import { AuditoriaModule } from '@/modules/auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [ConstantesController],
  providers: [ConstantesService, PrismaService],
  exports: [ConstantesService],
})
export class ConstantesModule {}
