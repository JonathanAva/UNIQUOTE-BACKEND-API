import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { ConstantesService } from './constantes.service';
import { CreateConstanteDto } from './dto/create-constante.dto';
import { UpdateConstanteDto } from './dto/update-constante.dto';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';

@ApiTags('Constantes')
@Controller('constantes')
export class ConstantesController {
  constructor(private readonly constantesService: ConstantesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una constante' })
  create(@Body() createConstanteDto: CreateConstanteDto) {
    return this.constantesService.create(createConstanteDto);
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
    @Body() updateConstanteDto: UpdateConstanteDto,
  ) {
    return this.constantesService.update(id, updateConstanteDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una constante' })
  @ApiParam({ name: 'id', type: Number })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.constantesService.remove(id);
  }

  @Get('categoria/:categoria')
async getByCategoria(@Param('categoria') categoria: string) {
  return this.constantesService.findByCategoria(categoria);
}

}
