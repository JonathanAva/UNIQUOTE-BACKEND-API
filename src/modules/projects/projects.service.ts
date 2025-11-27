// src/modules/cotizaciones/projects/projects.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/infra/database/prisma.service';

import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea un proyecto asociado a un cliente (y contacto opcional).
   * createdById se toma del usuario autenticado.
   */
  async create(dto: CreateProjectDto, createdById: number) {
    // Verifica que exista el cliente
    const cliente = await this.prisma.cliente.findUnique({
      where: { id: dto.clienteId },
      select: { id: true },
    });
    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }

    // Si se envía contactoId, valida que pertenezca a ese cliente
    if (dto.contactoId) {
      const contacto = await this.prisma.contactoEmpresa.findFirst({
        where: { id: dto.contactoId, clienteId: dto.clienteId },
        select: { id: true },
      });
      if (!contacto) {
        throw new NotFoundException(
          'El contacto no pertenece al cliente especificado',
        );
      }
    }

    return this.prisma.project.create({
      data: {
        clienteId: dto.clienteId,
        contactoId: dto.contactoId,
        name: dto.name,
        projectType: dto.projectType,
        studyType: dto.studyType,
        createdById,
      },
      select: {
        id: true,
        name: true,
        projectType: true,
        studyType: true,
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
  }

  /**
   * Lista proyectos por cliente.
   * Ej: para Pizza Hut, ver todos los proyectos y cantidad de cotizaciones.
   */
  async findAllByCliente(clienteId: number) {
    return this.prisma.project.findMany({
      where: { clienteId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        projectType: true,
        studyType: true,
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
   * Detalle de un proyecto con sus cotizaciones incluidas.
   * Útil para la “biblioteca” de cotizaciones por proyecto.
   */
  async findOneWithCotizaciones(id: number) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        projectType: true,
        studyType: true,
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

    if (!project) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    return project;
  }

  async update(id: number, dto: UpdateProjectDto, userId: number) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: { id: true, createdById: true, clienteId: true },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    // Regla de negocio opcional: solo quien lo creó puede editar
    if (project.createdById !== userId) {
      throw new ForbiddenException(
        'Solo el usuario que creó el proyecto puede editarlo',
      );
    }

    // Valida cliente/contacto si se envían cambios
    if (dto.clienteId && dto.clienteId !== project.clienteId) {
      const cliente = await this.prisma.cliente.findUnique({
        where: { id: dto.clienteId },
        select: { id: true },
      });
      if (!cliente) throw new NotFoundException('Cliente no encontrado');
    }

    if (dto.contactoId) {
      const contacto = await this.prisma.contactoEmpresa.findFirst({
        where: {
          id: dto.contactoId,
          clienteId: dto.clienteId ?? project.clienteId,
        },
        select: { id: true },
      });
      if (!contacto) {
        throw new NotFoundException(
          'El contacto no pertenece al cliente especificado',
        );
      }
    }

    return this.prisma.project.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        name: true,
        projectType: true,
        studyType: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: number, userId: number) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      select: { id: true, createdById: true },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    if (project.createdById !== userId) {
      throw new ForbiddenException(
        'Solo el usuario que creó el proyecto puede eliminarlo',
      );
    }

    await this.prisma.project.delete({ where: { id } });
    return { deleted: true };
  }
}
