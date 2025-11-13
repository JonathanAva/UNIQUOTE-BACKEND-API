import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { PrismaService } from '@/infra/database/prisma.service';
import { RoleIdsGuard } from '@/modules/auth/guards/role-ids.guard';

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, PrismaService, RoleIdsGuard],
  exports: [ProjectsService],
})
export class ProjectsModule {}
