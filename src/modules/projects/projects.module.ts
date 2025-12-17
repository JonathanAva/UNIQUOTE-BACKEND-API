import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { PrismaService } from '@/infra/database/prisma.service';
import { RoleIdsGuard } from '@/modules/auth/guards/role-ids.guard';
import { AuditoriaModule } from '@/modules/auditoria/auditoria.module';

@Module({
  imports: [AuditoriaModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, PrismaService, RoleIdsGuard],
  exports: [ProjectsService],
})
export class ProjectsModule {}
