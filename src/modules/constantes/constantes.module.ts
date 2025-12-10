import { Module } from '@nestjs/common';
import { ConstantesService } from './constantes.service';
import { ConstantesController } from './constantes.controller';
import { PrismaService } from '@/infra/database/prisma.service';

@Module({
  controllers: [ConstantesController],
  providers: [ConstantesService, PrismaService],
   exports: [ConstantesService],
})
export class ConstantesModule {}
