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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RoleIdsGuard } from '@/modules/auth/guards/role-ids.guard';
import { RoleIds } from '@/modules/auth/decorators/role-ids.decorator';
import type { Request } from 'express';

@ApiTags('Proyectos')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RoleIdsGuard)
// Ajusta los roleIds según tu definición (ej. admin, gerente, director)
@RoleIds(1, 2, 3)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear un nuevo proyecto para un cliente (y contacto opcional)',
  })
  create(@Body() dto: CreateProjectDto, @Req() req: Request) {
    const user = req.user as any;
    return this.projectsService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar proyectos por cliente (con conteo de cotizaciones)',
  })
  @ApiQuery({
    name: 'clienteId',
    type: Number,
    required: true,
    description: 'ID del cliente',
  })
  findAllByCliente(@Query('clienteId', ParseIntPipe) clienteId: number) {
    return this.projectsService.findAllByCliente(clienteId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener detalle de proyecto + lista de cotizaciones',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.findOneWithCotizaciones(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar datos del proyecto' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    return this.projectsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un proyecto' })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const user = req.user as any;
    return this.projectsService.remove(id, user.id);
  }
}
