import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CotizacionesService } from './cotizaciones.service';
import { CreateCotizacionDto } from './dto/create-cotizacion.dto';
import { UpdateCotizacionDto } from './dto/update-cotizacion.dto';
import { UpdateCotizacionStatusDto } from './dto/update-cotizacion-status.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RoleIdsGuard } from '@/modules/auth/guards/role-ids.guard';
import { RoleIds } from '@/modules/auth/decorators/role-ids.decorator';
import type { Request } from 'express';

@ApiTags('Cotizaciones')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RoleIdsGuard)
// Misma lógica de roles que para proyectos 
@RoleIds(1, 2, 3)
@Controller('cotizaciones')
export class CotizacionesController {
  constructor(private readonly service: CotizacionesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva cotización para un proyecto' })
  create(@Body() dto: CreateCotizacionDto, @Req() req: Request) {
    const user = req.user as any;
    return this.service.create(dto, user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar cotizaciones por proyecto',
  })
  @ApiQuery({
    name: 'projectId',
    type: Number,
    required: true,
    description: 'ID del proyecto',
  })
  findAllByProject(@Query('projectId', ParseIntPipe) projectId: number) {
    return this.service.findAllByProject(projectId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalles de una cotización (con items)',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Actualizar inputs de la cotización (si no está aprobada/rechazada)',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCotizacionDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    return this.service.update(id, dto, user.id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Cambiar estado de la cotización' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCotizacionStatusDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    return this.service.updateStatus(id, dto, user.id);
  }

  @Post(':id/clone')
  @ApiOperation({
    summary:
      'Clonar una cotización (solo si está en estado aprobado) como borrador',
  })
  clone(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const user = req.user as any;
    return this.service.clone(id, user.id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar una cotización (si no está aprobada)',
  })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const user = req.user as any;
    return this.service.remove(id, user.id);
  }

  @Get(':id/distribucion-nacional')
  @ApiOperation({
    summary: 'Obtener tabla de distribución nacional por departamento',
  })
  getDistribucionNacional(@Param('id', ParseIntPipe) id: number) {
    return this.service.getDistribucionNacional(id);
  }


}


