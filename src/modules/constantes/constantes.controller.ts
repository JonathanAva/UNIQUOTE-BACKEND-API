// src/modules/constantes/constantes.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConstantesService } from './constantes.service';
import { CreateConstanteDto } from './dto/create-constante.dto';
import { UpdateConstanteDto } from './dto/update-constante.dto';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';

import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RoleIdsGuard } from '@/modules/auth/guards/role-ids.guard';
import { RoleIds } from '@/modules/auth/decorators/role-ids.decorator';
import type { Request } from 'express';

@ApiTags('Constantes')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RoleIdsGuard)
@RoleIds(1, 2) // Admin, Gerente (ajusta si querés que otro rol modifique)
@Controller('constantes')
export class ConstantesController {
  constructor(private readonly constantesService: ConstantesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una constante' })
  create(@Body() dto: CreateConstanteDto, @Req() req: Request) {
    const user = req.user as any;
    return this.constantesService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas las constantes' })
  findAll() {
    return this.constantesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una constante por ID' })
  @ApiParam({ name: 'id', type: Number })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.constantesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una constante' })
  @ApiParam({ name: 'id', type: Number })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateConstanteDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    return this.constantesService.update(id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una constante' })
  @ApiParam({ name: 'id', type: Number })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const user = req.user as any;
    return this.constantesService.remove(id, user.id);
  }

  @Get('categoria/:nombre')
  @ApiOperation({ summary: 'Obtener constantes por categoría' })
  @ApiParam({
    name: 'nombre',
    required: true,
    description: 'Nombre exacto de la categoría (ej. "Trabajo de Campo")',
  })
  async getByCategoria(@Param('nombre') nombre: string) {
    return this.constantesService.findByCategoria(nombre);
  }

  @Get('subcategoria/:nombre')
  @ApiOperation({ summary: 'Obtener constantes por subcategoría' })
  @ApiParam({
    name: 'nombre',
    required: true,
    description:
      'Nombre exacto/parte de la subcategoría (ej. "Viático - San Miguel")',
  })
  async getBySubcategoria(@Param('nombre') nombre: string) {
    return this.constantesService.findBySubcategoria(nombre);
  }
}
