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

        // ⬇️⬇️ NUEVO: guardar el flag
        clienteSolicitaTablas: dto.clienteSolicitaTablas ?? false,

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

        // ⬇️⬇️ NUEVO: pasarlo al builder
        clienteSolicitaTablas: dto.clienteSolicitaTablas === true,

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

        // ⬇️⬇️ NUEVO: devolver el flag
        clienteSolicitaTablas: true,

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
 // ------------------------------------------------------
// CLONAR COTIZACIÓN
// ------------------------------------------------------
async clone(id: number, userId: number) {
  const cot = await this.prisma.cotizacion.findUnique({
    where: { id },
    select: {
      // ⬇⬇⬇ todos los escalares que luego copias al create
      id: true,
      projectId: true,
      contactoId: true,
      name: true,
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
      // ⬅⬅⬅ AQUI el flag que faltaba
      clienteSolicitaTablas: true,
      incentivoTotal: true,
      factorComisionablePct: true,
      factorNoComisionablePct: true,
      totalCobrar: true,
      costoPorEntrevista: true,
      // relación
      items: true,
      status: true,
      createdById: true,
    },
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

        // ✅ ahora compila
        clienteSolicitaTablas: cot.clienteSolicitaTablas,

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
          id: undefined as unknown as number, // evitar colisión de PK
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

// Dentro de CotizacionesService

/**
 * Edita un ítem de la cotización y recalcula:
 *  - totalConComision del ítem (si corresponde)
 *  - totalCobrar de la cotización (suma de todos los items.totalConComision)
 *  - costoPorEntrevista = totalCobrar / totalEntrevistas
 *
 * Reglas:
 *  1) Si vienen personas/dias/costoUnitario -> recalculamos costoTotal = personas*dias*costoUnitario
 *     y luego totalConComision con factores.
 *  2) Si viene costoTotal (y NO viene personas/dias/unit) -> usamos ese costoTotal y calculamos totalConComision.
 *  3) Si viene solo totalConComision -> lo tomamos como override y recalculamos costoTotal = totalConComision / factor.
 *  4) Si vienen costoTotal y totalConComision, prevalece costoTotal (recalculamos totalConComision con factores).
 */
async updateItem(
  cotizacionId: number,
  itemId: number,
  dto: {
    personas?: number | null;
    dias?: number | null;
    costoUnitario?: number | null;
    costoTotal?: number | null;
    comisionable?: boolean;
    totalConComision?: number | null;
  },
  userId: number,
) {
  // 1) Cargar cotización para permisos y factores
  const cot = await this.prisma.cotizacion.findUnique({
    where: { id: cotizacionId },
    select: {
      id: true,
      createdById: true,
      status: true,
      totalEntrevistas: true,
      factorComisionablePct: true,
      factorNoComisionablePct: true,
    },
  });

  if (!cot) throw new NotFoundException('Cotización no encontrada');

  if (cot.status === CotizacionStatus.APROBADO || cot.status === CotizacionStatus.NO_APROBADO) {
    throw new BadRequestException('No se puede editar una cotización aprobada o no aprobada');
  }

  if (cot.createdById !== userId) {
    throw new ForbiddenException('Solo el usuario que creó la cotización puede actualizarla');
  }

  // 2) Cargar ítem
  const item = await this.prisma.cotizacionItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      cotizacionId: true,
      personas: true,
      dias: true,
      costoUnitario: true,
      costoTotal: true,
      comisionable: true,
      totalConComision: true,
      orden: true,
    },
  });

  if (!item || item.cotizacionId !== cotizacionId) {
    throw new NotFoundException('Ítem no encontrado en esta cotización');
  }

  // 3) Determinar valores base
  const personas = dto.personas ?? (item.personas as any as number | null);
  const dias = dto.dias ?? (item.dias as any as number | null);
  const costoUnitario = dto.costoUnitario ?? (item.costoUnitario as any as number | null);
  const comisionable = dto.comisionable ?? item.comisionable;

  const fC = Number(cot.factorComisionablePct ?? 1); // p.ej. 1 = +100%
  const fNC = Number(cot.factorNoComisionablePct ?? 0.05); // p.ej. 0.05 = +5%
  const factor = comisionable ? 1 + fC : 1 + fNC;

  let costoTotal: number | null | undefined = dto.costoTotal ?? (item.costoTotal as any as number | null);
  let totalConComision: number | null | undefined = dto.totalConComision ?? (item.totalConComision as any as number | null);

  const envioPersonasDiasUnit = dto.personas !== undefined || dto.dias !== undefined || dto.costoUnitario !== undefined;
  const envioCostoTotal = dto.costoTotal !== undefined;
  const envioTotalConCom = dto.totalConComision !== undefined;

  // 4) Reglas de recálculo
  if (envioPersonasDiasUnit) {
    // personas*dias*unit → costoTotal → totalConComision
    if (personas != null && dias != null && costoUnitario != null) {
      costoTotal = Number(personas) * Number(dias) * Number(costoUnitario);
    } else {
      // Si falta alguno, lo dejamos como estaba (o null)
      costoTotal = costoTotal ?? null;
    }
    totalConComision = costoTotal != null ? Number(costoTotal) * factor : null;
  } else if (envioCostoTotal) {
    // costoTotal → totalConComision
    totalConComision = costoTotal != null ? Number(costoTotal) * factor : null;
  } else if (envioTotalConCom) {
    // totalConComision → costoTotal (backsolve)
    costoTotal = totalConComision != null ? Number(totalConComision) / factor : null;
  } else {
    // No enviaron valores que afecten montos: mantener montos actuales
    // (o recalcular por consistencia)
    if (costoTotal != null) {
      totalConComision = Number(costoTotal) * factor;
    }
  }

  // Redondeos a 2 decimales (opcional)
  const r2 = (v: number | null | undefined) =>
    v == null ? null : Math.round(Number(v) * 100) / 100;

  const dataUpdate = {
    personas: personas as any,
    dias: dias as any,
    costoUnitario: costoUnitario as any,
    comisionable,
    costoTotal: r2(costoTotal) as any,
    totalConComision: r2(totalConComision) as any,
  };

  // 5) Persistir en transacción y recalcular totales de la cotización
  await this.prisma.$transaction(async (tx) => {
    await tx.cotizacionItem.update({
      where: { id: itemId },
      data: dataUpdate,
    });

    const suma = await tx.cotizacionItem.aggregate({
      where: { cotizacionId },
      _sum: { totalConComision: true },
    });

    const totalCobrar = Number(suma._sum.totalConComision ?? 0);
    const costoPorEntrevista =
      cot.totalEntrevistas > 0 ? Math.round((totalCobrar / cot.totalEntrevistas) * 100) / 100 : 0;

    await tx.cotizacion.update({
      where: { id: cotizacionId },
      data: {
        totalCobrar: Math.round(totalCobrar * 100) / 100,
        costoPorEntrevista,
      },
    });
  });

  // 6) Devolver la cotización completa (como tu findOne)
  return this.findOne(cotizacionId);
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
