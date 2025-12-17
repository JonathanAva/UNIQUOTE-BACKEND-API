import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ContactosService } from './contactos.service';
import { CreateContactoDto } from './dto/create-contacto.dto';
import { UpdateContactoDto } from './dto/update-contacto.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RoleIds } from '@/modules/auth/decorators/role-ids.decorator';
import { RoleIdsGuard } from '@/modules/auth/guards/role-ids.guard';
import { Request } from 'express';

// Endpoints para gestionar contactos de empresas (clientes)
@ApiTags('Contactos')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RoleIdsGuard)
@RoleIds(1, 2, 3)
@Controller('contactos')
export class ContactosController {
  constructor(private readonly service: ContactosService) {}

  /**
   * Toma el userId desde el JWT.
   * Ajusta aquí si tu payload usa otra propiedad.
   */
  private getPerformedById(req: Request & { user?: any }) {
    const id = Number(req.user?.id ?? req.user?.sub);
    if (!id) throw new UnauthorizedException('Usuario no autenticado');
    return id;
  }

  @Post()
  @ApiOperation({ summary: 'Crear contacto de empresa' })
  create(@Body() dto: CreateContactoDto, @Req() req: Request & { user?: any }) {
    const performedById = this.getPerformedById(req);
    return this.service.create(dto, performedById);
  }

  @Get()
  @ApiOperation({ summary: 'Listar contactos por cliente' })
  @ApiQuery({ name: 'clienteId', type: Number, required: true })
  findAllByCliente(@Query('clienteId') clienteId: number) {
    // Se fuerza a number por si viene como string en la query
    return this.service.findAllByCliente(Number(clienteId));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener contacto por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar contacto' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContactoDto,
    @Req() req: Request & { user?: any },
  ) {
    const performedById = this.getPerformedById(req);
    return this.service.update(id, dto, performedById);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar contacto' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user?: any },
  ) {
    const performedById = this.getPerformedById(req);
    return this.service.remove(id, performedById);
  }
}
