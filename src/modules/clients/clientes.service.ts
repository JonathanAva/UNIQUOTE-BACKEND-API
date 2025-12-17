// src/modules/clientes/clientes.service.ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/infra/database/prisma.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { CotizacionStatus } from '@prisma/client';
import { AuditoriaService } from '@/modules/auditoria/auditoria.service';

@Injectable()
export class ClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async create(dto: CreateClienteDto, performedById: number) {
    const exists = await this.prisma.cliente.findFirst({
      where: { empresa: dto.empresa, razonSocial: dto.razonSocial },
      select: { id: true },
    });
    if (exists) {
      throw new ConflictException(
        'Ya existe un cliente con esa empresa y razón social',
      );
    }

    const created = await this.prisma.cliente.create({
      data: dto,
      select: {
        id: true,
        empresa: true,
        razonSocial: true,
        createdAt: true,
      },
    });

    await this.auditoria.log({
      accion: 'CREAR_CLIENTE',
      descripcion: `Creó cliente "${created.empresa}" (${created.razonSocial})`,
      entidad: 'CLIENTE',
      entidadId: created.id,
      performedById,
      metadata: {
        after: created,
      },
    });

    return created;
  }

  async findAll() {
    const clientes = await this.prisma.cliente.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        empresa: true,
        razonSocial: true,
        createdAt: true,
        updatedAt: true,
        projects: {
          select: {
            cotizaciones: {
              select: { status: true },
            },
          },
        },
      },
    });

    return clientes.map((c) => {
      const todas = c.projects.flatMap((p) => p.cotizaciones);
      const totalCotizaciones = todas.length;
      const aprobadas = todas.filter(
        (ct) => ct.status === CotizacionStatus.APROBADO,
      ).length;

      const porcentajeAprobadas =
        totalCotizaciones > 0
          ? Number(((aprobadas / totalCotizaciones) * 100).toFixed(2))
          : 0;

      return {
        id: c.id,
        empresa: c.empresa,
        razonSocial: c.razonSocial,
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

  async update(id: number, dto: UpdateClienteDto, performedById: number) {
    const exists = await this.prisma.cliente.findUnique({
      where: { id },
      select: {
        id: true,
        empresa: true,
        razonSocial: true,
      },
    });
    if (!exists) throw new NotFoundException('Cliente no encontrado');

    if (
      (dto.empresa && dto.empresa !== exists.empresa) ||
      (dto.razonSocial && dto.razonSocial !== exists.razonSocial)
    ) {
      const dup = await this.prisma.cliente.findFirst({
        where: {
          empresa: dto.empresa ?? exists.empresa,
          razonSocial: dto.razonSocial ?? exists.razonSocial,
          NOT: { id },
        },
        select: { id: true },
      });
      if (dup) {
        throw new ConflictException(
          'Ya existe otro cliente con esa empresa y razón social',
        );
      }
    }

    const updated = await this.prisma.cliente.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        empresa: true,
        razonSocial: true,
        updatedAt: true,
      },
    });

    await this.auditoria.log({
      accion: 'EDITAR_CLIENTE',
      descripcion: `Editó cliente "${updated.empresa}" (${updated.razonSocial})`,
      entidad: 'CLIENTE',
      entidadId: updated.id,
      performedById,
      metadata: {
        before: exists,
        after: updated,
        changes: dto,
      },
    });

    return updated;
  }

  async remove(id: number, performedById: number) {
    const exists = await this.prisma.cliente.findUnique({
      where: { id },
      select: { id: true, empresa: true, razonSocial: true },
    });
    if (!exists) throw new NotFoundException('Cliente no encontrado');

    await this.prisma.cliente.delete({ where: { id } });

    await this.auditoria.log({
      accion: 'ELIMINAR_CLIENTE',
      descripcion: `Eliminó cliente "${exists.empresa}" (${exists.razonSocial})`,
      entidad: 'CLIENTE',
      entidadId: exists.id,
      performedById,
      metadata: { deleted: exists },
    });

    return { deleted: true };
  }
}
