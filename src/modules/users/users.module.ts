import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaService } from '@/infra/database/prisma.service';
import { AuditoriaModule } from '@/modules/auditoria/auditoria.module';

// Módulo de Usuarios
@Module({
  imports: [AuditoriaModule],
  controllers: [UsersController],
  providers: [UsersService, PrismaService],
})
export class UsersModule {}
