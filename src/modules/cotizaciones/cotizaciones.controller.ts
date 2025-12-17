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
import { UpdateCotizacionItemDto } from './dto/update-cotizacion-item.dto';
import { UpdateDistribucionDto } from './dto/update-distribucion.dto';
import { RebuildCotizacionDto } from './dto/rebuild-cotizacion.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RoleIdsGuard } from '@/modules/auth/guards/role-ids.guard';
import { RoleIds } from '@/modules/auth/decorators/role-ids.decorator';
import type { Request } from 'express';

@ApiTags('Cotizaciones')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RoleIdsGuard)
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
  @ApiOperation({ summary: 'Listar cotizaciones por proyecto' })
  @ApiQuery({
    name: 'projectId',
    type: Number,
    required: true,
    description: 'ID del proyecto',
  })
  findAllByProject(@Query('projectId', ParseIntPipe) projectId: number) {
    return this.service.findAllByProject(projectId);
  }

  @Get('all')
  @ApiOperation({ summary: 'Listar todas las cotizaciones' })
  findAll() {
    return this.service.findAll();
  }

  @Get('mine')
  @ApiOperation({ summary: 'Listar mis cotizaciones (usuario autenticado)' })
  findMine(@Req() req: Request) {
    const user = req.user as any;
    return this.service.findByUser(user.id);
  }

  @Get('by-cliente/:clienteId')
  @ApiOperation({ summary: 'Listar cotizaciones por cliente' })
  findByCliente(@Param('clienteId', ParseIntPipe) clienteId: number) {
    return this.service.findByCliente(clienteId);
  }

  @Get('stats/total')
  @ApiOperation({ summary: 'Total de cotizaciones registradas' })
  getTotalCotizaciones() {
    return this.service.countAll();
  }

  @Get('stats/pendientes')
  @ApiOperation({ summary: 'Total de cotizaciones en estado ENVIADO (pendientes)' })
  getTotalPendientes() {
    return this.service.countByStatus('ENVIADO');
  }

  @Get('stats/aprobadas')
  @ApiOperation({ summary: 'Total de cotizaciones aprobadas' })
  getTotalAprobadas() {
    return this.service.countByStatus('APROBADO');
  }

  @Get('stats/no-aprobadas')
  @ApiOperation({ summary: 'Total de cotizaciones no aprobadas' })
  getTotalNoAprobadas() {
    return this.service.countByStatus('NO_APROBADO');
  }

  @Get('stats/ultimos-6-meses')
  @ApiOperation({
    summary: 'Cotizaciones: Total vs Aprobadas/No aprobadas (últimos 6 meses)',
  })
  getStatsUltimos6Meses() {
    return this.service.getStatsUltimos6Meses();
  }

  @Get('stats/actividad-semanal')
  @ApiOperation({
    summary: 'Cotizaciones creadas esta semana por día (Lun-Vie)',
  })
  @ApiQuery({
    name: 'weekOffset',
    required: false,
    type: Number,
    description: '0 = semana actual, -1 = semana pasada, etc.',
  })
  getActividadSemanal(@Query('weekOffset') weekOffset?: string) {
    const offset = weekOffset != null ? Number(weekOffset) : 0;
    return this.service.getActividadSemanal(Number.isFinite(offset) ? offset : 0);
  }

    // ------------------------------------------------------
  // ✅ STATS POR USUARIOS / MINE
  // ------------------------------------------------------

  // ✅ Admin/Gerente: resumen por usuario
  @Get('stats/users/summary')
  @RoleIds(1, 2)
  @ApiOperation({ summary: 'Resumen de cotizaciones por usuario (ADMIN/GERENTE)' })
  getStatsUsersSummary() {
    return this.service.getStatsResumenPorUsuarios();
  }

  // ✅ Admin/Gerente: últimos 6 meses por usuario
  @Get('stats/users/ultimos-6-meses')
  @RoleIds(1, 2)
  @ApiOperation({ summary: 'Últimos 6 meses por usuario (ADMIN/GERENTE)' })
  getStatsUsersUltimos6Meses() {
    return this.service.getStatsUltimos6MesesPorUsuarios();
  }

  // ✅ Admin/Gerente: actividad semanal por usuario
  @Get('stats/users/actividad-semanal')
  @RoleIds(1, 2)
  @ApiOperation({ summary: 'Actividad semanal por usuario (ADMIN/GERENTE)' })
  @ApiQuery({
    name: 'weekOffset',
    required: false,
    type: Number,
    description: '0 = semana actual, -1 = semana pasada, etc.',
  })
  getStatsUsersActividadSemanal(@Query('weekOffset') weekOffset?: string) {
    const offset = weekOffset != null ? Number(weekOffset) : 0;
    return this.service.getActividadSemanalPorUsuarios(Number.isFinite(offset) ? offset : 0);
  }

  // ✅ Usuario logueado: resumen
  @Get('stats/mine/summary')
  @ApiOperation({ summary: 'Resumen de mis cotizaciones (usuario logueado)' })
  getStatsMineSummary(@Req() req: Request) {
    const user = req.user as any;
    return this.service.getStatsResumenMine(user.id);
  }

  // ✅ Usuario logueado: últimos 6 meses
  @Get('stats/mine/ultimos-6-meses')
  @ApiOperation({ summary: 'Mis cotizaciones: Total vs estados (últimos 6 meses)' })
  getStatsMineUltimos6Meses(@Req() req: Request) {
    const user = req.user as any;
    return this.service.getStatsUltimos6MesesMine(user.id);
  }

  // ✅ Usuario logueado: actividad semanal
  @Get('stats/mine/actividad-semanal')
  @ApiOperation({ summary: 'Mis cotizaciones creadas esta semana por día (Lun-Vie)' })
  @ApiQuery({
    name: 'weekOffset',
    required: false,
    type: Number,
    description: '0 = semana actual, -1 = semana pasada, etc.',
  })
  getStatsMineActividadSemanal(@Req() req: Request, @Query('weekOffset') weekOffset?: string) {
    const user = req.user as any;
    const offset = weekOffset != null ? Number(weekOffset) : 0;
    return this.service.getActividadSemanalMine(user.id, Number.isFinite(offset) ? offset : 0);
  }


  // ✅ NUEVO: Snapshot FULL (absolutamente todo)
  @Get(':id/full')
  @ApiOperation({ summary: 'Obtener snapshot completo (cotización + items + overrides + distribución final)' })
  getFull(@Param('id', ParseIntPipe) id: number) {
    return this.service.getFullSnapshot(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalles de una cotización (con items)' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  // === NUEVO ===
  @Get(':id/distribucion')
  @ApiOperation({ summary: 'Obtener tabla de distribución (AMSS o Nacional según cobertura)' })
  getDistribucion(@Param('id', ParseIntPipe) id: number) {
    return this.service.getDistribucion(id);
  }

  @Get(':id/distribucion-nacional')
  @ApiOperation({ summary: 'Obtener tabla de distribución nacional por departamento' })
  getDistribucionNacional(@Param('id', ParseIntPipe) id: number) {
    return this.service.getDistribucionNacional(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar inputs de la cotización (si no está aprobada/rechazada)',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCotizacionDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    return this.service.update(id, dto, user.id);
  }

  @Patch(':id/items/:itemId')
  @ApiOperation({ summary: 'Editar un ítem de la cotización y recalcular totales' })
  updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateCotizacionItemDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    return this.service.updateItem(id, itemId, dto, user.id);
  }

  // === NUEVO (alias genérico) ===
  @Patch(':id/distribucion')
  @UseGuards(JwtAuthGuard, RoleIdsGuard)
  @RoleIds(1, 2) // Admin, Gerente
  @ApiOperation({
    summary:
      'Editar tabla de distribución (AMSS/Nacional). Recalcula trabajo de campo y devuelve la tabla completa',
  })
  updateDistribucionGenerica(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDistribucionDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    return this.service.updateDistribucionNacional(id, dto, user.id);
  }

  @Patch(':id/distribucion-nacional')
  @UseGuards(JwtAuthGuard, RoleIdsGuard)
  @RoleIds(1, 2) // Admin, Gerente
  @ApiOperation({
    summary:
      'Editar tabla de distribución nacional (ADMIN/GERENTE). Recalcula trabajo de campo y devuelve la tabla completa',
  })
  updateDistribucion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDistribucionDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    return this.service.updateDistribucionNacional(id, dto, user.id);
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
    summary: 'Clonar una cotización (solo si está en estado aprobado) como borrador',
  })
  clone(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const user = req.user as any;
    return this.service.clone(id, user.id);
  }

  // ✅ NUEVO: REBUILD
  @Post(':id/rebuild')
  @ApiOperation({
    summary:
      'Regenerar ítems desde los inputs actuales (o nuevos inputs). Borra items y (por defecto) overrides. Devuelve snapshot completo.',
  })
  rebuild(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RebuildCotizacionDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    return this.service.rebuild(id, dto, user.id);
  }

  // === NUEVO (alias genérico) ===
  @Delete(':id/distribucion')
  @UseGuards(JwtAuthGuard, RoleIdsGuard)
  @RoleIds(1, 2)
  @ApiOperation({
    summary: 'Eliminar overrides de distribución (AMSS/Nacional) y volver al engine',
  })
  resetDistribucionGenerica(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const user = req.user as any;
    return this.service.resetDistribucionNacional(id, user.id);
  }

  @Delete(':id/distribucion-nacional')
  @UseGuards(JwtAuthGuard, RoleIdsGuard)
  @RoleIds(1, 2)
  @ApiOperation({ summary: 'Eliminar overrides de distribución nacional y volver al engine' })
  resetDistribucion(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const user = req.user as any;
    return this.service.resetDistribucionNacional(id, user.id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar una cotización (si no está aprobada)',
  })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const user = req.user as any;
    return this.service.remove(id, user.id);
  }
}
