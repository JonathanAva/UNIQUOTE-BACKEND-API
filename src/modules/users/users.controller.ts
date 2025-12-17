import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { RoleIdsGuard } from '@/modules/auth/guards/role-ids.guard';
import { RoleIds } from '@/modules/auth/decorators/role-ids.decorator';
import type { Request } from 'express';

// Endpoints CRUD para Usuarios
@ApiTags('Usuarios')
@ApiBearerAuth('jwt')
@UseGuards(JwtAuthGuard, RoleIdsGuard)
@RoleIds(1, 2) // Admin / Gerente (ajusta si querés)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nuevo usuario' })
  create(@Body() createUserDto: CreateUserDto, @Req() req: Request) {
    const user = req.user as any;
    return this.usersService.create(createUserDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos los usuarios' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar usuario por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar usuario' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    return this.usersService.update(id, updateUserDto, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar usuario' })
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const user = req.user as any;
    return this.usersService.remove(id, user.id);
  }
}
