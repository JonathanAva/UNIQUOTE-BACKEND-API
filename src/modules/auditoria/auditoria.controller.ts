import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuditoriaService } from './auditoria.service';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RoleIdsGuard } from '@/modules/auth/guards/role-ids.guard';
import { RoleIds } from '@/modules/auth/decorators/role-ids.decorator';

@ApiTags('Auditoría')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RoleIdsGuard)
@RoleIds(1, 2) // Admin/Gerente
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly service: AuditoriaService) {}

  @Get()
  @ApiOperation({ summary: 'Listar auditoría (actividad reciente)' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({ name: 'entidad', required: false, type: String })
  @ApiQuery({ name: 'entidadId', required: false, type: Number })
  @ApiQuery({ name: 'cotizacionId', required: false, type: Number })
  @ApiQuery({ name: 'performedById', required: false, type: Number })
  findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('entidad') entidad?: string,
    @Query('entidadId') entidadId?: string,
    @Query('cotizacionId') cotizacionId?: string,
    @Query('performedById') performedById?: string,
  ) {
    return this.service.findAll({
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
      entidad: entidad ?? undefined,
      entidadId: entidadId ? Number(entidadId) : undefined,
      cotizacionId: cotizacionId ? Number(cotizacionId) : undefined,
      performedById: performedById ? Number(performedById) : undefined,
    });
  }
}
