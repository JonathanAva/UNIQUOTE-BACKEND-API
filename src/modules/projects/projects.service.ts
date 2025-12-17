// src/modules/projects/projects.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/infra/database/prisma.service';
import { Prisma } from '@prisma/client';

import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AuditoriaService } from '@/modules/auditoria/auditoria.service';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Convierte cualquier objeto (DTO, Date, Decimal, etc.) a JSON válido para Prisma Json.
   * Evita el error TS de InputJsonValue.
   */
  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  /**
   * Crear proyecto
   */
  async create(dto: CreateProjectDto, createdById: number) {
    // Validar cliente
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: dto.clienteId },
      select: { id: true },
    });
    if (!cliente) throw new NotFoundException('Cliente no encontrado');

    // Validar contacto (si viene)
    if (dto.contactoId) {
      const contacto = await this.prisma.contactoEmpresa.findFirst({
        where: { id: dto.contactoId, clienteId: dto.clienteId },
        select: { id: true },
      });
      if (!contacto)
        throw new NotFoundException(
          'El contacto no pertenece al cliente especificado',
        );
    }

    const created = await this.prisma.project.create({
      data: {
        clienteId: dto.clienteId,
        contactoId: dto.contactoId ?? null,
        name: dto.name,
        createdById,
      },
      select: {
        id: true,
        name: true,
        cliente: {
          select: { id: true, empresa: true, razonSocial: true },
        },
        contacto: {
          select: { id: true, nombre: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true, lastName: true },
        },
        createdAt: true,
      },
    });

    // ✅ Auditoría: crear proyecto
    await this.auditoria.log({
      accion: 'CREAR_PROYECTO',
      descripcion: `Creó proyecto "${created.name}" (Cliente: ${created.cliente.empresa})`,
      entidad: 'PROJECT',
      entidadId: created.id,
      performedById: createdById,
      metadata: this.toJson({
        after: created,
        inputs: dto,
      }),
    });

    return created;
  }

  /**
   * Listar proyectos de un cliente
   */
  async findAllByCliente(clienteId: number) {
    return this.prisma.project.findMany({
      where: { clienteId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        cliente: {
          select: { id: true, empresa: true, razonSocial: true },
        },
        contacto: {
          select: { id: true, nombre: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true, lastName: true },
        },
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { cotizaciones: true },
        },
      },
    });
  }

  /**
   * Listar todos los proyectos
   */
  async findAll() {
    return this.prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        cliente: {
          select: { id: true, empresa: true, razonSocial: true },
        },
        contacto: {
          select: { id: true, nombre: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true, lastName: true },
        },
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { cotizaciones: true },
        },
      },
    });
  }

  /**
   * Obtener proyecto con sus cotizaciones
   */
  async findOneWithCotizaciones(id: number) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        cliente: {
          select: { id: true, empresa: true, razonSocial: true },
        },
        contacto: {
          select: { id: true, nombre: true, email: true },
        },
        createdBy: {
          select: { id: true, name: true, lastName: true },
        },
        createdAt: true,
        updatedAt: true,

        cotizaciones: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            totalEntrevistas: true,
            totalCobrar: true,
            costoPorEntrevista: true,
            createdAt: true,
            contacto: {
              select: { id: true, nombre: true, email: true },
            },
            createdBy: {
              select: { id: true, name: true, lastName: true },
            },
          },
        },
      },
    });

    if (!project) throw new NotFoundException('Proyecto no encontrado');

    return project;
  }

  /**
   * Actualizar proyecto
   */
  async update(id: number, dto: UpdateProjectDto, userId: number) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        createdById: true,
        clienteId: true,
        contactoId: true,
      },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    if (project.createdById !== userId) {
      throw new ForbiddenException(
        'Solo el usuario que creó el proyecto puede editarlo',
      );
    }

    // Validación de cliente y contacto si cambian
    if (dto.clienteId && dto.clienteId !== project.clienteId) {
      const cliente = await this.prisma.cliente.findUnique({
        where: { id: dto.clienteId },
      });
      if (!cliente) throw new NotFoundException('Cliente no encontrado');
    }

    if (dto.contactoId) {
      const contacto = await this.prisma.contactoEmpresa.findFirst({
        where: {
          id: dto.contactoId,
          clienteId: dto.clienteId ?? project.clienteId,
        },
      });
      if (!contacto)
        throw new NotFoundException(
          'El contacto no pertenece al cliente especificado',
        );
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        clienteId: dto.clienteId ?? project.clienteId,
        contactoId: dto.contactoId ?? null,
        name: dto.name ?? undefined,
      },
      select: {
        id: true,
        name: true,
        cliente: {
          select: {
            id: true,
            empresa: true,
            razonSocial: true,
          },
        },
        contacto: {
          select: {
            id: true,
            nombre: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            lastName: true,
          },
        },
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            cotizaciones: true,
          },
        },
      },
    });

    // ✅ Auditoría: editar proyecto
    await this.auditoria.log({
      accion: 'EDITAR_PROYECTO',
      descripcion: `Editó proyecto "${updated.name}" (ID: ${updated.id})`,
      entidad: 'PROJECT',
      entidadId: updated.id,
      performedById: userId,
      metadata: this.toJson({
        before: project,
        after: updated,
        changes: dto,
      }),
    });

    return updated;
  }

  /**
   * Eliminar proyecto
   */
  async remove(id: number, userId: number) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        createdById: true,
        clienteId: true,
        contactoId: true,
        createdAt: true,
      },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    if (project.createdById !== userId) {
      throw new ForbiddenException(
        'Solo el usuario que creó el proyecto puede eliminarlo',
      );
    }

    await this.prisma.project.delete({ where: { id } });

    // ✅ Auditoría: eliminar proyecto
    await this.auditoria.log({
      accion: 'ELIMINAR_PROYECTO',
      descripcion: `Eliminó proyecto "${project.name}" (ID: ${project.id})`,
      entidad: 'PROJECT',
      entidadId: project.id,
      performedById: userId,
      metadata: this.toJson({
        deleted: project,
      }),
    });

    return { deleted: true };
  }
}
