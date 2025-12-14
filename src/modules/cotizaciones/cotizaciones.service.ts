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
import { UpdateDistribucionDto } from './dto/update-distribucion.dto';
import { ConstantesService } from '@/modules/constantes/constantes.service';

// ✅ Pipeline por pasos para permitir overrides persistentes
import {
  distribuirEntrevistasNacional,
  aplicarRendimientoNacional,
  aplicarEncuestadoresYSupervisoresNacional,
  aplicarDiasCampoYCostosNacional,
  aplicarPrecioBoletaNacional,
  calcularTotalesViaticosTransporteHotelNacional,
  calcularPagosPersonalNacional,
  type DistribucionNacionalResult,
} from '@/modules/cotizaciones/engine/casa-por-casa/nacional.engine';

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
        penetracionCategoria: penetracion, // 💥 validado
        cobertura: dto.cobertura,
        supervisores: dto.supervisores,
        encuestadoresTotales: dto.encuestadoresTotales,

        // Flag tablas
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
        penetracionCategoria: penetracion,
        cobertura: dto.cobertura,
        supervisores: dto.supervisores,
        encuestadoresTotales: dto.encuestadoresTotales,
        realizamosCuestionario: dto.realizamosCuestionario,
        realizamosScript: dto.realizamosScript,
        clienteSolicitaReporte: dto.clienteSolicitaReporte,
        clienteSolicitaInformeBI: dto.clienteSolicitaInformeBI,
        numeroOlasBi: dto.numeroOlasBi ?? 2,
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

    // ✅ Normalizar penetración si viene
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
        projectId: dto.projectId ?? undefined,
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
      select: {
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
        clienteSolicitaTablas: true,
        incentivoTotal: true,
        factorComisionablePct: true,
        factorNoComisionablePct: true,
        totalCobrar: true,
        costoPorEntrevista: true,
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
            id: undefined as unknown as number,
            cotizacionId: nueva.id,
          })),
        });
      }

      return nueva;
    });

    return this.findOne(clone.id);
  }

  // ------------------------------------------------------
  // DISTRIBUCIÓN NACIONAL (con overrides por cotización)
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

    // Base: distribución de entrevistas
    let dist: DistribucionNacionalResult = distribuirEntrevistasNacional(
      cot.totalEntrevistas,
      cot.tipoEntrevista,
    );

    // Overrides guardados
    const overrides = await this.prisma.cotizacionDistribucionOverride.findMany({
      where: { cotizacionId },
    });

    // Pre-aplicar campos que afectan pasos siguientes (urbano/rural/total, horas/tiempo)
    dist = this.applyOverrides(dist, overrides, {
      earlyOnly: true,
    });

    // Resto del pipeline, respetando overrides posteriores
    const pen =
      cot.penetracionCategoria > 1
        ? cot.penetracionCategoria / 100
        : cot.penetracionCategoria;

    dist = aplicarRendimientoNacional(dist, {
      duracionCuestionarioMin: cot.duracionCuestionarioMin,
      penetracion: pen,
      totalEncuestadores: cot.encuestadoresTotales,
      segmentSize: 20,
      filterMinutes: 2,
      searchMinutes: 8,
      desplazamientoMin: 60,
      groupSize: 4,
    });

    dist = aplicarEncuestadoresYSupervisoresNacional(
      dist,
      cot.encuestadoresTotales,
      { groupSize: 4, supervisorSplit: 4 },
    );

    dist = aplicarDiasCampoYCostosNacional(dist);

    // Re-aplicar overrides finales (rendimiento, encuestadores, supervisores, días, units, precioBoleta)
    dist = this.applyOverrides(dist, overrides, {
      lateOnly: true,
    });

    // Si NO hubo override de precioBoleta, aplicar tabla estándar
    const anyPrecioOverride = dist.filas.some(
      (f) => typeof f.precioBoleta === 'number' && !Number.isNaN(f.precioBoleta),
    );
    if (!anyPrecioOverride) {
      dist = aplicarPrecioBoletaNacional(dist, {
        duracionCuestionarioMin: cot.duracionCuestionarioMin,
        penetracion: pen,
      });
    }

    dist = calcularTotalesViaticosTransporteHotelNacional(dist);
    dist = calcularPagosPersonalNacional(dist);

    return dist;
  }

  // Aplica overrides en momentos distintos del pipeline
  private applyOverrides(
    base: DistribucionNacionalResult,
    overrides: Array<{
      departamento: string;
      urbano?: number | null;
      rural?: number | null;
      total?: number | null;
      horasEfectivas?: number | null;
      tiempoEfectivoMin?: number | null;
      rendimiento?: number | null;
      encuestadores?: number | null;
      supervisores?: number | null;
      diasCampoEncuest?: number | null;
      viaticosUnit?: number | null;
      tMicrobusUnit?: number | null;
      hotelUnit?: number | null;
      precioBoleta?: number | null;
    }>,
    opts?: { earlyOnly?: boolean; lateOnly?: boolean },
  ): DistribucionNacionalResult {
    const early = Boolean(opts?.earlyOnly);
    const late = Boolean(opts?.lateOnly);

    const map = new Map(overrides.map((o) => [o.departamento, o]));

    let totalDias = 0;

    const filas = base.filas.map((fila) => {
      const o = map.get(fila.departamento);
      if (!o) return fila;

      const next = { ...fila };

      // EARLY: afectan cálculos iniciales
      if (!late) {
        if (o.urbano != null) next.urbano = Number(o.urbano);
        if (o.rural != null) next.rural = Number(o.rural);
        if (o.total != null) next.total = Number(o.total);
        else if (o.urbano != null || o.rural != null) {
          next.total = (o.urbano ?? next.urbano ?? 0) + (o.rural ?? next.rural ?? 0);
        }
        if (o.horasEfectivas != null) next.horasEfectivas = Number(o.horasEfectivas);
        if (o.tiempoEfectivoMin != null) next.tiempoEfectivoMin = Number(o.tiempoEfectivoMin);
      }

      // LATE: pisan resultados del pipeline
      if (!early) {
        if (o.rendimiento != null) next.rendimiento = Number(o.rendimiento);
        if (o.encuestadores != null) next.encuestadores = Number(o.encuestadores);
        if (o.supervisores != null) next.supervisores = Number(o.supervisores);
        if (o.diasCampoEncuest != null) next.diasCampoEncuest = Number(o.diasCampoEncuest);

        if (o.viaticosUnit != null) next.viaticosUnit = Number(o.viaticosUnit);
        if (o.tMicrobusUnit != null) next.tMicrobusUnit = Number(o.tMicrobusUnit);
        if (o.hotelUnit != null) next.hotelUnit = Number(o.hotelUnit);

        if (o.precioBoleta != null) next.precioBoleta = Number(o.precioBoleta);
      }

      // Recalcular días si NO hay override explícito y existen Q/T/U válidos
      if (!early) {
        if (o?.diasCampoEncuest == null) {
          const Q = Number(next.total ?? 0);
          const T = Number(next.rendimiento ?? 0);
          const U = Number(next.encuestadores ?? 0);
          if (Q > 0 && T > 0 && U > 0) {
            next.diasCampoEncuest = (Q / (T * U)) * 1.05;
          }
        }
        if (typeof next.diasCampoEncuest === 'number') {
          totalDias += next.diasCampoEncuest;
        }
      }

      return next;
    });

    return {
      ...base,
      filas,
      totalDiasCampoEncuestGlobal:
        !early && late ? Math.ceil(totalDias) : base.totalDiasCampoEncuestGlobal,
    };
  }

  // ------------------------------------------------------
  // EDITAR / RESET DISTRIBUCIÓN NACIONAL (guardar overrides + recalcular)
  // ------------------------------------------------------
  async updateDistribucionNacional(
    cotizacionId: number,
    dto: UpdateDistribucionDto,
    _userId: number,
  ) {
    const cot = await this.prisma.cotizacion.findUnique({
      where: { id: cotizacionId },
      select: { id: true, status: true },
    });
    if (!cot) throw new NotFoundException('Cotización no encontrada');

    if (
      cot.status === CotizacionStatus.APROBADO ||
      cot.status === CotizacionStatus.NO_APROBADO
    ) {
      throw new BadRequestException(
        'No se puede editar la distribución de una cotización aprobada/no aprobada',
      );
    }

    // Guardar overrides por fila (upsert)
    await this.prisma.$transaction(async (tx) => {
      for (const row of dto.rows) {
        const { departamento, ...rest } = row as any;
        await tx.cotizacionDistribucionOverride.upsert({
          where: {
            cotizacionId_departamento: { cotizacionId, departamento },
          },
          update: rest,
          create: { cotizacionId, departamento, ...rest },
        });
      }
    });

    // Recalcular Trabajo de Campo + dependientes desde la nueva distribución
    await this.recalcularTrabajoCampoYRecursosDesdeDistribucion(cotizacionId);

    // Devolver tabla final ya recalculada (completa)
    return this.getDistribucionNacional(cotizacionId);
  }

  async resetDistribucionNacional(cotizacionId: number, _userId: number) {
    const cot = await this.prisma.cotizacion.findUnique({
      where: { id: cotizacionId },
      select: { id: true, status: true },
    });
    if (!cot) throw new NotFoundException('Cotización no encontrada');

    if (
      cot.status === CotizacionStatus.APROBADO ||
      cot.status === CotizacionStatus.NO_APROBADO
    ) {
      throw new BadRequestException(
        'No se puede resetear la distribución de una cotización aprobada/no aprobada',
      );
    }

    await this.prisma.cotizacionDistribucionOverride.deleteMany({
      where: { cotizacionId },
    });

    await this.recalcularTrabajoCampoYRecursosDesdeDistribucion(cotizacionId);

    return this.getDistribucionNacional(cotizacionId);
  }

  // ------------------------------------------------------
  // Recalcular Trabajo de Campo + Recursos + Dirección (afectados por distribución)
  // ------------------------------------------------------
  private async recalcularTrabajoCampoYRecursosDesdeDistribucion(
    cotizacionId: number,
  ) {
    const cot = await this.prisma.cotizacion.findUnique({
      where: { id: cotizacionId },
      select: {
        id: true,
        totalEntrevistas: true,
        duracionCuestionarioMin: true,
        tipoEntrevista: true,
        penetracionCategoria: true,
        supervisores: true,
        encuestadoresTotales: true,
        factorComisionablePct: true,
        factorNoComisionablePct: true,
        trabajoDeCampoRealiza: true,
        trabajoDeCampoTipo: true,
      },
    });
    if (!cot) throw new NotFoundException('Cotización no encontrada');

    // Solo recalcular si el trabajo de campo es propio
    if (!cot.trabajoDeCampoRealiza || cot.trabajoDeCampoTipo !== 'propio')
      return;

    // 1) Distribución final (ya con overrides)
    const dist = await this.getDistribucionNacional(cotizacionId);

    const diasCampo = Math.max(
      0,
      Math.round((dist.totalDiasCampoEncuestGlobal ?? 0) * 100) / 100,
    );
    const totalViaticos = Math.round(
      (dist.totalViaticosGlobal ?? 0) * 100,
    ) / 100;
    const totalTransporte = Math.round(
      (dist.totalTMicrobusGlobal ?? 0) * 100,
    ) / 100;
    const totalHotel = Math.round((dist.totalHotelGlobal ?? 0) * 100) / 100;
    const totalPagoEncuestadores = Math.round(
      (dist.totalPagoEncuestadoresGlobal ?? 0) * 100,
    ) / 100;
    const totalPagoSupervisores =
      Math.round((dist.totalPagoSupervisoresGlobal ?? 0) * 100) / 100;

    const fC = Number(cot.factorComisionablePct ?? 1);
    const fNC = Number(cot.factorNoComisionablePct ?? 0.05);
    const totalPersonasCampo =
      Number(cot.encuestadoresTotales) + Number(cot.supervisores);

    const withCom = (base: number, comisionable: boolean) =>
      Math.round(base * (comisionable ? 1 + fC : 1 + fNC) * 100) / 100;

    // 2) Buscar ítems a impactar
    const items = await this.prisma.cotizacionItem.findMany({
      where: { cotizacionId },
      select: {
        id: true,
        category: true,
        description: true,
        personas: true,
        dias: true,
        costoUnitario: true,
        comisionable: true,
        orden: true,
      },
    });

    const find = (cat: string, desc: string) =>
      items.find((i) => i.category === cat && i.description === desc);

    const updates: Array<
      ReturnType<typeof this.prisma.cotizacionItem.update>
    > = [];

    // Dirección Trabajo Campo
    const itDirCampo = find('TRABAJO DE CAMPO', 'Dirección Trabajo Campo');
    if (itDirCampo) {
      const personas = 1;
      const dias = diasCampo;
      const unit = Number(itDirCampo.costoUnitario ?? 50);
      const base = Math.round(personas * dias * unit * 100) / 100;
      updates.push(
        this.prisma.cotizacionItem.update({
          where: { id: itDirCampo.id },
          data: {
            personas,
            dias,
            costoUnitario: unit,
            costoTotal: base,
            totalConComision: withCom(base, true),
          },
        }),
      );
    }

    // Capacitación
    const itCap = find('TRABAJO DE CAMPO', 'Capacitación');
    if (itCap) {
      const personas = totalPersonasCampo;
      const dias = 1;
      const unit = Number(itCap.costoUnitario ?? 8);
      const base = Math.round(personas * dias * unit * 100) / 100;
      updates.push(
        this.prisma.cotizacionItem.update({
          where: { id: itCap.id },
          data: {
            personas,
            dias,
            costoUnitario: unit,
            costoTotal: base,
            totalConComision: withCom(base, true),
          },
        }),
      );
    }

    // Supervisor (prorrateado)
    const itSup = find('TRABAJO DE CAMPO', 'Supervisor');
    if (itSup) {
      const personas = Number(cot.supervisores);
      const dias = diasCampo;
      const base = totalPagoSupervisores;
      const unit =
        personas > 0 && dias > 0
          ? Math.round((base / (personas * dias)) * 100) / 100
          : 0;
      updates.push(
        this.prisma.cotizacionItem.update({
          where: { id: itSup.id },
          data: {
            personas,
            dias,
            costoUnitario: unit,
            costoTotal: base,
            totalConComision: withCom(base, true),
          },
        }),
      );
    }

    // Encuestadores (prorrateado)
    const itEnc = find('TRABAJO DE CAMPO', 'Encuestadores');
    if (itEnc) {
      const personas = Number(cot.encuestadoresTotales);
      const dias = diasCampo;
      const base = totalPagoEncuestadores;
      const unit =
        personas > 0 && dias > 0
          ? Math.round((base / (personas * dias)) * 100) / 100
          : 0;
      updates.push(
        this.prisma.cotizacionItem.update({
          where: { id: itEnc.id },
          data: {
            personas,
            dias,
            costoUnitario: unit,
            costoTotal: base,
            totalConComision: withCom(base, true),
          },
        }),
      );
    }

    // Viáticos (prorrateado)
    const itVia = find('TRABAJO DE CAMPO', 'Viáticos');
    if (itVia) {
      const personas = totalPersonasCampo;
      const dias = diasCampo;
      const base = totalViaticos;
      const unit =
        personas > 0 && dias > 0
          ? Math.round((base / (personas * dias)) * 100) / 100
          : 0;
      updates.push(
        this.prisma.cotizacionItem.update({
          where: { id: itVia.id },
          data: {
            personas,
            dias,
            costoUnitario: unit,
            costoTotal: base,
            totalConComision: withCom(base, true),
          },
        }),
      );
    }

    // Transporte (prorrateado)
    const itTrans = find('TRABAJO DE CAMPO', 'Transporte');
    if (itTrans) {
      const personas = totalPersonasCampo;
      const dias = diasCampo;
      const base = totalTransporte;
      const unit =
        personas > 0 && dias > 0
          ? Math.round((base / (personas * dias)) * 100) / 100
          : 0;
      updates.push(
        this.prisma.cotizacionItem.update({
          where: { id: itTrans.id },
          data: {
            personas,
            dias,
            costoUnitario: unit,
            costoTotal: base,
            totalConComision: withCom(base, true),
          },
        }),
      );
    }

    // Hotel (prorrateado; no comisionable)
    const itHotel = find('TRABAJO DE CAMPO', 'Hotel');
    if (itHotel) {
      const personas = totalPersonasCampo;
      const dias = diasCampo;
      const base = totalHotel;
      const unit =
        personas > 0 && dias > 0
          ? Math.round((base / (personas * dias)) * 100) / 100
          : 0;
      updates.push(
        this.prisma.cotizacionItem.update({
          where: { id: itHotel.id },
          data: {
            personas,
            dias,
            costoUnitario: unit,
            costoTotal: base,
            totalConComision: withCom(base, false), // no comisionable
          },
        }),
      );
    }

    // 3) RECURSOS dependientes de días de campo
    const itTelCampo = find('RECURSOS', 'Teléfono celular (campo)');
    if (itTelCampo) {
      const personas = totalPersonasCampo;
      const dias = diasCampo;
      const unit = Number(itTelCampo.costoUnitario ?? 0);
      const base = Math.round(personas * dias * unit * 100) / 100;
      updates.push(
        this.prisma.cotizacionItem.update({
          where: { id: itTelCampo.id },
          data: {
            personas,
            dias,
            costoUnitario: unit,
            costoTotal: base,
            totalConComision: withCom(base, false),
          },
        }),
      );
    }

    const itInternet = find('RECURSOS', 'Internet a encuestadores');
    if (itInternet) {
      const personas = Number(cot.encuestadoresTotales);
      const dias = diasCampo;
      const unit = Number(itInternet.costoUnitario ?? 0);
      const base = Math.round(personas * dias * unit * 100) / 100;
      updates.push(
        this.prisma.cotizacionItem.update({
          where: { id: itInternet.id },
          data: {
            personas,
            dias,
            costoUnitario: unit,
            costoTotal: base,
            totalConComision: withCom(base, false),
          },
        }),
      );
    }

    const itUsoDisp = find('RECURSOS', 'Uso de dispositivos');
    if (itUsoDisp) {
      const personas = totalPersonasCampo;
      const dias = diasCampo;
      const unit = Number(itUsoDisp.costoUnitario ?? 0);
      const base = Math.round(personas * dias * unit * 100) / 100;
      updates.push(
        this.prisma.cotizacionItem.update({
          where: { id: itUsoDisp.id },
          data: {
            personas,
            dias,
            costoUnitario: unit,
            costoTotal: base,
            totalConComision: withCom(base, false),
          },
        }),
      );
    }

    // 4) DIRECCIÓN → Días director (regla del builder)
    const itDiasDir = items.find(
      (i) => i.category === 'DIRECCIÓN' && i.description === 'Días director',
    );
    if (itDiasDir) {
      // horasTotales = 4 + (2 * diasCampo)
      const tarifa = Number(itDiasDir.costoUnitario ?? 10);
      const horasTotales = 4 + 2 * diasCampo;
      const base = Math.round(horasTotales * tarifa * 100) / 100;
      const totalConCom = Math.round((base / 0.4) * 100) / 100; // margen base 0.4
      updates.push(
        this.prisma.cotizacionItem.update({
          where: { id: itDiasDir.id },
          data: {
            personas: 1,
            dias: horasTotales,
            costoUnitario: tarifa,
            costoTotal: base,
            totalConComision: totalConCom,
          },
        }),
      );
    }

    // Ejecutar updates y recalcular totales de la cotización
    await this.prisma.$transaction(updates);

    const suma = await this.prisma.cotizacionItem.aggregate({
      where: { cotizacionId },
      _sum: { totalConComision: true },
    });

    const totalCobrar = Number(suma._sum.totalConComision ?? 0);
    const cotFull = await this.prisma.cotizacion.findUnique({
      where: { id: cotizacionId },
      select: { totalEntrevistas: true },
    });
    const cpe =
      (cotFull?.totalEntrevistas ?? 0) > 0
        ? Math.round(
            (totalCobrar / (cotFull!.totalEntrevistas as number)) * 100,
          ) / 100
        : 0;

    await this.prisma.cotizacion.update({
      where: { id: cotizacionId },
      data: {
        totalCobrar: Math.round(totalCobrar * 100) / 100,
        costoPorEntrevista: cpe,
      },
    });
  }

  // ------------------------------------------------------
  // EDITAR ÍTEM
  // ------------------------------------------------------
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

    if (
      cot.status === CotizacionStatus.APROBADO ||
      cot.status === CotizacionStatus.NO_APROBADO
    ) {
      throw new BadRequestException(
        'No se puede editar una cotización aprobada o no aprobada',
      );
    }

    if (cot.createdById !== userId) {
      throw new ForbiddenException(
        'Solo el usuario que creó la cotización puede actualizarla',
      );
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
    const personas =
      dto.personas ?? ((item.personas as any) as number | null);
    const dias = dto.dias ?? ((item.dias as any) as number | null);
    const costoUnitario =
      dto.costoUnitario ?? ((item.costoUnitario as any) as number | null);
    const comisionable = dto.comisionable ?? item.comisionable;

    const fC = Number(cot.factorComisionablePct ?? 1); // p.ej. 1 = +100%
    const fNC = Number(cot.factorNoComisionablePct ?? 0.05); // p.ej. 0.05 = +5%
    const factor = comisionable ? 1 + fC : 1 + fNC;

    let costoTotal: number | null | undefined =
      dto.costoTotal ?? ((item.costoTotal as any) as number | null);
    let totalConComision: number | null | undefined =
      dto.totalConComision ??
      ((item.totalConComision as any) as number | null);

    const envioPersonasDiasUnit =
      dto.personas !== undefined ||
      dto.dias !== undefined ||
      dto.costoUnitario !== undefined;
    const envioCostoTotal = dto.costoTotal !== undefined;
    const envioTotalConCom = dto.totalConComision !== undefined;

    // 4) Reglas de recálculo
    if (envioPersonasDiasUnit) {
      // personas*dias*unit → costoTotal → totalConComision
      if (personas != null && dias != null && costoUnitario != null) {
        costoTotal = Number(personas) * Number(dias) * Number(costoUnitario);
      } else {
        costoTotal = costoTotal ?? null;
      }
      totalConComision = costoTotal != null ? Number(costoTotal) * factor : null;
    } else if (envioCostoTotal) {
      totalConComision =
        costoTotal != null ? Number(costoTotal) * factor : null;
    } else if (envioTotalConCom) {
      costoTotal =
        totalConComision != null ? Number(totalConComision) / factor : null;
    } else {
      if (costoTotal != null) {
        totalConComision = Number(costoTotal) * factor;
      }
    }

    // Redondeos a 2 decimales
    const r2 = (v: number | null | undefined) =>
      v == null ? null : Math.round(Number(v) * 100) / 100;

    const dataUpdate = {
      personas: (personas as any) as number | null,
      dias: (dias as any) as number | null,
      costoUnitario: (costoUnitario as any) as number | null,
      comisionable,
      costoTotal: (r2(costoTotal) as any) as number | null,
      totalConComision: (r2(totalConComision) as any) as number | null,
    };

    // 5) Persistir y recalcular totales cotización
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
        cot.totalEntrevistas > 0
          ? Math.round((totalCobrar / cot.totalEntrevistas) * 100) / 100
          : 0;

      await tx.cotizacion.update({
        where: { id: cotizacionId },
        data: {
          totalCobrar: Math.round(totalCobrar * 100) / 100,
          costoPorEntrevista,
        },
      });
    });

    // 6) Devolver la cotización completa
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
