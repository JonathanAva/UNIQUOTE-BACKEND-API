import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/infra/database/prisma.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

@Injectable()
// Servicio que contiene la lógica de negocio para Clientes
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

    // Crea el cliente y devuelve campos clave
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
    // Lista todos los clientes ordenados por creación (recientes primero)
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
    // Busca cliente por ID
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
    // Verifica que el cliente exista
    const exists = await this.prisma.cliente.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Cliente no encontrado');

    // Si se modifica empresa o razón social, valida unicidad combinada
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

    // Actualiza campos y devuelve los más relevantes
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

    // Elimina el registro de Cliente
    await this.prisma.cliente.delete({ where: { id } });
    return { deleted: true };
  }
}
