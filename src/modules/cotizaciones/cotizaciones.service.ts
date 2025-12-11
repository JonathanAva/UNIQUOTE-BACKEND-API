// src/modules/cotizaciones/cotizaciones.service.ts

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/infra/database/prisma.service';
import { CreateCotizacionDto } from './dto/create-cotizacion.dto';
import { UpdateCotizacionDto } from './dto/update-cotizacion.dto';
import { UpdateCotizacionStatusDto } from './dto/update-cotizacion-status.dto';
import { CotizacionStatus } from '@prisma/client';
import { buildCotizacionCasaPorCasa } from './builder/casa-por-casa.builder';
import { buildDistribucionNacional } from '@/modules/cotizaciones/engine/casa-por-casa/nacional.engine';
import { ConstantesService } from '@/modules/constantes/constantes.service';



@Injectable()
export class CotizacionesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly constantesService: ConstantesService,   
  ) {}


  // ------------------------------------------------------
  // GENERAR CÓDIGO
  // ------------------------------------------------------
  private async generateCotizacionCode(projectId: number): Promise<string> {
    const count = await this.prisma.cotizacion.count({
      where: { projectId },
    });
    return `COT-${projectId}-${count + 1}`;
  }

  // ------------------------------------------------------
  // CREAR COTIZACIÓN
  // ------------------------------------------------------
async create(dto: CreateCotizacionDto, createdById: number) {
  const project = await this.prisma.project.findUnique({
    where: { id: dto.projectId },
    select: { id: true, clienteId: true },
  });

  if (!project) throw new NotFoundException('Proyecto no encontrado');

  if (dto.contactoId) {
    const contacto = await this.prisma.contactoEmpresa.findFirst({
      where: { id: dto.contactoId, clienteId: project.clienteId },
    });

    if (!contacto) {
      throw new NotFoundException(
        'El contacto no pertenece al cliente del proyecto',
      );
    }
  }

  if (dto.studyType.toLowerCase() === 'cualitativo' && !dto.metodologia) {
    throw new BadRequestException(
      'Debe seleccionar una metodología si el estudio es cualitativo',
    );
  }

  // ✨ Normaliza penetracion
  let penetracion: number;
  if (typeof dto.penetracionCategoria === 'string') {
    const value = dto.penetracionCategoria.trim().toLowerCase();

    if (value === 'fácil') penetracion = 0.85;
    else if (value === 'medio') penetracion = 0.60;
    else if (value === 'difícil') penetracion = 0.35;
    else if (value.endsWith('%')) penetracion = parseFloat(value) / 100;
    else penetracion = parseFloat(value);
  } else {
    penetracion = dto.penetracionCategoria;
  }

  if (!Number.isFinite(penetracion) || penetracion <= 0 || penetracion > 1) {
    throw new BadRequestException(
      'penetracionCategoria debe ser un número válido entre 0.01 y 1.00, o usar: fácil / medio / difícil / porcentaje',
    );
  }

  const code = await this.generateCotizacionCode(dto.projectId);

  const cotizacion = await this.prisma.cotizacion.create({
    data: {
      projectId: dto.projectId,
      contactoId: dto.contactoId ?? null,
      name: dto.name,
      code,
      createdById,
      status: CotizacionStatus.ENVIADO,
      studyType: dto.studyType,
      metodologia: dto.metodologia ?? null,
      trabajoDeCampoRealiza: dto.trabajoDeCampoRealiza,
      trabajoDeCampoTipo: dto.trabajoDeCampoTipo ?? undefined,
      trabajoDeCampoCosto: dto.trabajoDeCampoCosto ?? undefined,
      numeroOlasBi: dto.numeroOlasBi ?? 2,
      totalEntrevistas: dto.totalEntrevistas,
      duracionCuestionarioMin: dto.duracionCuestionarioMin,
      tipoEntrevista: dto.tipoEntrevista,
      penetracionCategoria: penetracion, // 💥 Aquí el valor ya validado
      cobertura: dto.cobertura,
      supervisores: dto.supervisores,
      encuestadoresTotales: dto.encuestadoresTotales,
      realizamosCuestionario: dto.realizamosCuestionario,
      realizamosScript: dto.realizamosScript,
      clienteSolicitaReporte: dto.clienteSolicitaReporte,
      clienteSolicitaInformeBI: dto.clienteSolicitaInformeBI,
      incentivoTotal: dto.incentivoTotal ?? null,
    },
  });

  const builderResult = await buildCotizacionCasaPorCasa(
    {
      totalEntrevistas: dto.totalEntrevistas,
      duracionCuestionarioMin: dto.duracionCuestionarioMin,
      tipoEntrevista: dto.tipoEntrevista,
      penetracionCategoria: penetracion, // 💥 Usamos la misma variable aquí
      cobertura: dto.cobertura,
      supervisores: dto.supervisores,
      encuestadoresTotales: dto.encuestadoresTotales,
      realizamosCuestionario: dto.realizamosCuestionario,
      realizamosScript: dto.realizamosScript,
      clienteSolicitaReporte: dto.clienteSolicitaReporte,
      clienteSolicitaInformeBI: dto.clienteSolicitaInformeBI,
      numeroOlasBi: dto.numeroOlasBi ?? 2,
      trabajoDeCampoRealiza: dto.trabajoDeCampoRealiza,
      trabajoDeCampoTipo:
        dto.trabajoDeCampoTipo === 'propio' ||
        dto.trabajoDeCampoTipo === 'subcontratado'
          ? dto.trabajoDeCampoTipo
          : undefined,
      trabajoDeCampoCosto: dto.trabajoDeCampoCosto ?? undefined,
    },
    this.constantesService,
  );

  if (builderResult.items.length > 0) {
    await this.prisma.cotizacionItem.createMany({
      data: builderResult.items.map((item) => ({
        cotizacionId: cotizacion.id,
        category: item.category,
        description: item.description,
        personas: item.personas,
        dias: item.dias,
        costoUnitario: item.costoUnitario,
        costoTotal: item.costoTotal,
        comisionable: item.comisionable,
        totalConComision: item.totalConComision,
        orden: item.orden,
      })),
    });
  }

  await this.prisma.cotizacion.update({
    where: { id: cotizacion.id },
    data: {
      totalCobrar: builderResult.totalCobrar,
      costoPorEntrevista: builderResult.costoPorEntrevista,
      factorComisionablePct: 1,
      factorNoComisionablePct: 0.05,
    },
  });

  return this.findOne(cotizacion.id);
}


  // ------------------------------------------------------
  // OBTENER UNA COTIZACIÓN
  // ------------------------------------------------------
  async findOne(id: number) {
    const cot = await this.prisma.cotizacion.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,

        project: {
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
          },
        },

        contacto: true,
        createdBy: { select: { id: true, name: true, lastName: true } },

        studyType: true,
        metodologia: true,

        
        trabajoDeCampoRealiza: true,
        trabajoDeCampoTipo: true,
        trabajoDeCampoCosto: true,

        numeroOlasBi: true,
        totalEntrevistas: true,
        duracionCuestionarioMin: true,
        tipoEntrevista: true,
        penetracionCategoria: true,
        cobertura: true,
        supervisores: true,
        encuestadoresTotales: true,
        realizamosCuestionario: true,
        realizamosScript: true,
        clienteSolicitaReporte: true,
        clienteSolicitaInformeBI: true,
        incentivoTotal: true,

        totalCobrar: true,
        costoPorEntrevista: true,
        factorComisionablePct: true,
        factorNoComisionablePct: true,

        items: { orderBy: { orden: 'asc' } },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!cot) throw new NotFoundException('Cotización no encontrada');
    return cot;
  }

  // ------------------------------------------------------
  // LISTAR POR PROYECTO
  // ------------------------------------------------------
  async findAllByProject(projectId: number) {
    return this.prisma.cotizacion.findMany({
      where: { projectId },
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
        contacto: true,
        createdBy: {
          select: { id: true, name: true, lastName: true },
        },
      },
    });
  }

  // ------------------------------------------------------
  // ACTUALIZAR
  // ------------------------------------------------------
async update(id: number, dto: UpdateCotizacionDto, userId: number) {
  const current = await this.prisma.cotizacion.findUnique({ where: { id } });
  if (!current) throw new NotFoundException('Cotización no encontrada');

  if (
    current.status === CotizacionStatus.APROBADO ||
    current.status === CotizacionStatus.NO_APROBADO
  ) {
    throw new BadRequestException(
      'No se puede editar una cotización aprobada o no aprobada',
    );
  }

  if (current.createdById !== userId) {
    throw new ForbiddenException(
      'Solo el usuario que creó la cotización puede actualizarla',
    );
  }

  if (dto.studyType?.toLowerCase() === 'cualitativo' && !dto.metodologia) {
    throw new BadRequestException(
      'Debe seleccionar una metodología si el estudio es cualitativo',
    );
  }

  // ✅ Normalizar penetracionCategoria si está presente
  let penetracion: number | undefined = undefined;

  if (dto.penetracionCategoria !== undefined) {
    if (typeof dto.penetracionCategoria === 'string') {
      const value = dto.penetracionCategoria.trim().toLowerCase();

      if (value === 'fácil') penetracion = 0.85;
      else if (value === 'medio') penetracion = 0.6;
      else if (value === 'difícil') penetracion = 0.35;
      else if (value.endsWith('%')) penetracion = parseFloat(value) / 100;
      else penetracion = parseFloat(value);
    } else {
      penetracion = dto.penetracionCategoria;
    }

    if (!Number.isFinite(penetracion) || penetracion <= 0 || penetracion > 1) {
      throw new BadRequestException(
        'penetracionCategoria debe ser un número válido entre 0.01 y 1.00, o usar: fácil / medio / difícil / porcentaje',
      );
    }
  }

  await this.prisma.cotizacion.update({
    where: { id },
    data: {
      ...dto,
      penetracionCategoria: penetracion ?? undefined,
      projectId: dto.projectId ?? undefined, // Para evitar conflicto de tipo
    },
  });

  return this.findOne(id);
}


  // ------------------------------------------------------
  // CAMBIAR ESTADO
  // ------------------------------------------------------
  async updateStatus(id: number, dto: UpdateCotizacionStatusDto, userId: number) {
    const current = await this.prisma.cotizacion.findUnique({
      where: { id },
      select: { createdById: true },
    });

    if (!current) throw new NotFoundException('Cotización no encontrada');

    if (current.createdById !== userId) {
      throw new ForbiddenException(
        'Solo el usuario que creó la cotización puede cambiar su estado',
      );
    }

    return this.prisma.cotizacion.update({
      where: { id },
      data: { status: dto.status },
      select: { id: true, code: true, name: true, status: true, updatedAt: true },
    });
  }

  // ------------------------------------------------------
  // CLONAR COTIZACIÓN
  // ------------------------------------------------------
  async clone(id: number, userId: number) {
    const cot = await this.prisma.cotizacion.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!cot) throw new NotFoundException('Cotización no encontrada');
    if (cot.status !== CotizacionStatus.APROBADO) {
      throw new BadRequestException('Solo se pueden clonar cotizaciones aprobadas');
    }

    const code = await this.generateCotizacionCode(cot.projectId);

    const clone = await this.prisma.$transaction(async (tx) => {
      const nueva = await tx.cotizacion.create({
        data: {
          projectId: cot.projectId,
          contactoId: cot.contactoId,
          name: `${cot.name} (copia)`,
          code,
          status: CotizacionStatus.ENVIADO,
          createdById: userId,

          studyType: cot.studyType,
          metodologia: cot.metodologia,
          trabajoDeCampoRealiza: cot.trabajoDeCampoRealiza,
          trabajoDeCampoTipo: cot.trabajoDeCampoTipo,
          trabajoDeCampoCosto: cot.trabajoDeCampoCosto,
          numeroOlasBi: cot.numeroOlasBi,

          totalEntrevistas: cot.totalEntrevistas,
          duracionCuestionarioMin: cot.duracionCuestionarioMin,
          tipoEntrevista: cot.tipoEntrevista,
          penetracionCategoria: cot.penetracionCategoria,
          cobertura: cot.cobertura,
          supervisores: cot.supervisores,
          encuestadoresTotales: cot.encuestadoresTotales,
          realizamosCuestionario: cot.realizamosCuestionario,
          realizamosScript: cot.realizamosScript,
          clienteSolicitaReporte: cot.clienteSolicitaReporte,
          clienteSolicitaInformeBI: cot.clienteSolicitaInformeBI,
          incentivoTotal: cot.incentivoTotal,
          factorComisionablePct: cot.factorComisionablePct,
          factorNoComisionablePct: cot.factorNoComisionablePct,
          totalCobrar: cot.totalCobrar,
          costoPorEntrevista: cot.costoPorEntrevista,
        },
      });

      if (cot.items.length > 0) {
        await tx.cotizacionItem.createMany({
          data: cot.items.map((i) => ({
            ...i,
            id: undefined,
            cotizacionId: nueva.id,
          })),
        });
      }

      return nueva;
    });

    return this.findOne(clone.id);
  }

  // ------------------------------------------------------
  // DISTRIBUCIÓN NACIONAL
  // ------------------------------------------------------
  async getDistribucionNacional(cotizacionId: number) {
    const cot = await this.prisma.cotizacion.findUnique({
      where: { id: cotizacionId },
      select: {
        id: true,
        studyType: true,
        trabajoDeCampoRealiza: true,
        trabajoDeCampoTipo: true,
        trabajoDeCampoCosto: true,
        totalEntrevistas: true,
        duracionCuestionarioMin: true,
        tipoEntrevista: true,
        penetracionCategoria: true,
        cobertura: true,
        supervisores: true,
        encuestadoresTotales: true,
        realizamosCuestionario: true,
        realizamosScript: true,
        clienteSolicitaReporte: true,
        clienteSolicitaInformeBI: true,
        numeroOlasBi: true,
      },
    });

    if (!cot) throw new NotFoundException('Cotización no encontrada');

    const result = buildDistribucionNacional({
      totalEntrevistas: cot.totalEntrevistas,
      duracionCuestionarioMin: cot.duracionCuestionarioMin,
      tipoEntrevista: cot.tipoEntrevista,
      penetracionCategoria:
      cot.penetracionCategoria > 1
      ? cot.penetracionCategoria / 100
      : cot.penetracionCategoria,

      cobertura: cot.cobertura,
      supervisores: cot.supervisores,
      encuestadoresTotales: cot.encuestadoresTotales,
      realizamosCuestionario: cot.realizamosCuestionario,
      realizamosScript: cot.realizamosScript,
      clienteSolicitaReporte: cot.clienteSolicitaReporte,
      clienteSolicitaInformeBI: cot.clienteSolicitaInformeBI,
      numeroOlasBi: cot.numeroOlasBi ?? 2,
      trabajoDeCampoRealiza: cot.trabajoDeCampoRealiza,
      trabajoDeCampoTipo:
      cot.trabajoDeCampoTipo === 'propio' || cot.trabajoDeCampoTipo === 'subcontratado'
      ? cot.trabajoDeCampoTipo
      : undefined,

trabajoDeCampoCosto: cot.trabajoDeCampoCosto ?? undefined,

    });

    return result;
  }

  // ------------------------------------------------------
// ELIMINAR COTIZACIÓN
// ------------------------------------------------------
async remove(id: number, userId: number) {
  const cotizacion = await this.prisma.cotizacion.findUnique({
    where: { id },
    select: {
      id: true,
      createdById: true,
      status: true,
    },
  });

  if (!cotizacion) {
    throw new NotFoundException('Cotización no encontrada');
  }

  if (cotizacion.status === CotizacionStatus.APROBADO) {
    throw new BadRequestException('No se puede eliminar una cotización aprobada');
  }

  if (cotizacion.createdById !== userId) {
    throw new ForbiddenException('Solo el creador puede eliminar la cotización');
  }

  await this.prisma.cotizacion.delete({ where: { id } });

  return { message: 'Cotización eliminada correctamente' };
  }

  // Todas las cotizaciones
async findAll() {
  return this.prisma.cotizacion.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      totalEntrevistas: true,
      totalCobrar: true,
      costoPorEntrevista: true,
      metodologia: true,
      createdAt: true,
      createdBy: {
        select: { id: true, name: true, lastName: true },
      },
      contacto: {
        select: { id: true, nombre: true, email: true },
      },
      project: {
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
        },
      },
    },
  });
}

// Cotizaciones creadas por un usuario
async findByUser(userId: number) {
  return this.prisma.cotizacion.findMany({
    where: { createdById: userId },
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
      project: {
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
        },
      },
    },
  });
}

// Cotizaciones por cliente
async findByCliente(clienteId: number) {
  return this.prisma.cotizacion.findMany({
    where: {
      project: {
        clienteId,
      },
    },
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
      createdBy: {
        select: { id: true, name: true, lastName: true },
      },
      contacto: {
        select: { id: true, nombre: true, email: true },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

async countAll() {
  const total = await this.prisma.cotizacion.count();
  return { total };
}

async countByStatus(status: CotizacionStatus | string) {
  const total = await this.prisma.cotizacion.count({
    where: { status: status as CotizacionStatus },
  });
  return { status, total };
}


}
