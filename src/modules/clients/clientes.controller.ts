import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RoleIds } from '@/modules/auth/decorators/role-ids.decorator';
import { RoleIdsGuard } from '@/modules/auth/guards/role-ids.guard';

// Grupo de endpoints para gestión de clientes (empresas)
@ApiTags('Clientes')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RoleIdsGuard)
// Solo roles con IDs 1,2,3 pueden acceder a estos endpoints
@RoleIds(1, 2, 3)
@Controller('clientes')
export class ClientesController {
  constructor(private readonly service: ClientesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear cliente' })
  create(@Body() dto: CreateClienteDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar clientes' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener cliente por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar cliente' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateClienteDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar cliente' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
