// roles.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infra/database/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRoleDto) {
    return this.prisma.role.create({ data: dto });
  }

  async findAll() {
    return this.prisma.role.findMany();
  }

  async findOne(id: number) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException(`Rol con id ${id} no encontrado`);
    return role;
  }

  async update(id: number, dto: UpdateRoleDto) {
    return this.prisma.role.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    return this.prisma.role.delete({ where: { id } });
  }
}
