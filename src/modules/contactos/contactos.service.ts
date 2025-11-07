import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/infra/database/prisma.service';
import { CreateContactoDto } from './dto/create-contacto.dto';
import { UpdateContactoDto } from './dto/update-contacto.dto';

@Injectable()
export class ContactosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateContactoDto) {
    // verifica que exista el cliente
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: Number(dto.clienteId) },
      select: { id: true },
    });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');

    // valida email único global (o por cliente si lo configuraste así)
    const dupEmail = await this.prisma.contactoEmpresa.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (dupEmail) throw new ConflictException('El correo ya está registrado');

    const created = await this.prisma.contactoEmpresa.create({
      data: {
        clienteId: Number(dto.clienteId),
        nombre: dto.nombre,
        email: dto.email,
        telefono: dto.telefono,
      },
      select: {
        id: true,
        clienteId: true,
        nombre: true,
        email: true,
        telefono: true,
        createdAt: true,
      },
    });
    return created;
  }

  async findAllByCliente(clienteId: number) {
    // opcional: validar existencia del cliente
    return this.prisma.contactoEmpresa.findMany({
      where: { clienteId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        clienteId: true,
        nombre: true,
        email: true,
        telefono: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findOne(id: number) {
    const c = await this.prisma.contactoEmpresa.findUnique({
      where: { id },
      select: {
        id: true,
        clienteId: true,
        nombre: true,
        email: true,
        telefono: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!c) throw new NotFoundException('Contacto no encontrado');
    return c;
  }

  async update(id: number, dto: UpdateContactoDto) {
    const current = await this.prisma.contactoEmpresa.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Contacto no encontrado');

    // si cambia email, valida unicidad
    if (dto.email && dto.email !== current.email) {
      const dup = await this.prisma.contactoEmpresa.findUnique({
        where: { email: dto.email },
        select: { id: true },
      });
      if (dup) throw new ConflictException('El correo ya está registrado');
    }

    // si cambia clienteId, valida que exista
    if (dto.clienteId && dto.clienteId !== current.clienteId) {
      const cliente = await this.prisma.cliente.findUnique({
        where: { id: Number(dto.clienteId) },
        select: { id: true },
      });
      if (!cliente) throw new NotFoundException('Cliente destino no existe');
    }

    return this.prisma.contactoEmpresa.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        clienteId: true,
        nombre: true,
        email: true,
        telefono: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: number) {
    const exists = await this.prisma.contactoEmpresa.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Contacto no encontrado');
    await this.prisma.contactoEmpresa.delete({ where: { id } });
    return { deleted: true };
  }
}
