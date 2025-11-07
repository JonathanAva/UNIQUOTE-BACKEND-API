import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/infra/database/prisma.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateClienteDto) {
    // valida unicidad empresa+razonSocial
    const exists = await this.prisma.cliente.findFirst({
      where: { empresa: dto.empresa, razonSocial: dto.razonSocial },
      select: { id: true },
    });
    if (exists) {
      throw new ConflictException('Ya existe un cliente con esa empresa y razón social');
    }

    return this.prisma.cliente.create({
      data: dto,
      select: {
        id: true,
        empresa: true,
        razonSocial: true,
        createdAt: true,
      },
    });
  }

  async findAll() {
    return this.prisma.cliente.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        empresa: true,
        razonSocial: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findOne(id: number) {
    const c = await this.prisma.cliente.findUnique({
      where: { id },
      select: {
        id: true,
        empresa: true,
        razonSocial: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!c) throw new NotFoundException('Cliente no encontrado');
    return c;
  }

  async update(id: number, dto: UpdateClienteDto) {
    const exists = await this.prisma.cliente.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Cliente no encontrado');

    if ((dto.empresa && dto.empresa !== exists.empresa) ||
        (dto.razonSocial && dto.razonSocial !== exists.razonSocial)) {
      const dup = await this.prisma.cliente.findFirst({
        where: {
          empresa: dto.empresa ?? exists.empresa,
          razonSocial: dto.razonSocial ?? exists.razonSocial,
          NOT: { id },
        },
        select: { id: true },
      });
      if (dup) {
        throw new ConflictException('Ya existe otro cliente con esa empresa y razón social');
      }
    }

    return this.prisma.cliente.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        empresa: true,
        razonSocial: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: number) {
    const exists = await this.prisma.cliente.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Cliente no encontrado');

    await this.prisma.cliente.delete({ where: { id } });
    return { deleted: true };
  }
}
