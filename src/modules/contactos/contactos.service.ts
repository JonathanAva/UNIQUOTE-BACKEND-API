// src/modules/contactos/contactos.service.ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/infra/database/prisma.service';
import { CreateContactoDto } from './dto/create-contacto.dto';
import { UpdateContactoDto } from './dto/update-contacto.dto';
import { CotizacionStatus } from '@prisma/client';

@Injectable()
// Servicio con lógica de negocio de contactos de empresa
export class ContactosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateContactoDto) {
    // verifica que exista el cliente
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: Number(dto.clienteId) },
      select: { id: true },
    });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');

    // valida email único global
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

  /**
   * Lista todos los contactos de un cliente con stats de cotizaciones
   * aprobadas para cada contacto.
   */
  async findAllByCliente(clienteId: number) {
    const contactos = await this.prisma.contactoEmpresa.findMany({
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
        cotizaciones: {
          select: { status: true },
        },
      },
    });

    return contactos.map((c) => {
      const totalCotizaciones = c.cotizaciones.length;
      const aprobadas = c.cotizaciones.filter(
        (ct) => ct.status === CotizacionStatus.APROBADO,
      ).length;
      const porcentajeAprobadas =
        totalCotizaciones > 0
          ? Number(((aprobadas / totalCotizaciones) * 100).toFixed(2))
          : 0;

      return {
        id: c.id,
        clienteId: c.clienteId,
        nombre: c.nombre,
        email: c.email,
        telefono: c.telefono,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        stats: {
          totalCotizaciones,
          aprobadas,
          porcentajeAprobadas,
        },
      };
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
    const current = await this.prisma.contactoEmpresa.findUnique({
      where: { id },
    });
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
    const exists = await this.prisma.contactoEmpresa.findUnique({
      where: { id },
    });
    if (!exists) throw new NotFoundException('Contacto no encontrado');
    await this.prisma.contactoEmpresa.delete({ where: { id } });
    return { deleted: true };
  }
}
