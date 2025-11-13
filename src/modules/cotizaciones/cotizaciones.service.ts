// src/modules/cotizaciones/cotizaciones.service.ts

import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/infra/database/prisma.service';
import { CreateCotizacionDto } from './dto/create-cotizacion.dto';
import { UpdateCotizacionDto } from './dto/update-cotizacion.dto';
import { UpdateCotizacionStatusDto } from './dto/update-cotizacion-status.dto';

// Motor del cotizador para cobertura "Nacional"
import {
  distribuirEntrevistasNacional,
  aplicarRendimientoNacional,
  aplicarEncuestadoresYSupervisoresNacional,
  aplicarDiasCampoYCostosNacional,
  type ParamsRendimiento,
} from './engine/tarifario-nacional';

@Injectable()
export class CotizacionesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Helpers internos
  // ---------------------------------------------------------------------------

  /**
   * Genera un código simple de cotización dentro de un proyecto.
   * Ejemplo: COT-<projectId>-<secuencia>
   */
  private async generateCotizacionCode(projectId: number): Promise<string> {
    const count = await this.prisma.cotizacion.count({
      where: { projectId },
    });
    const seq = count + 1;
    return `COT-${projectId}-${seq}`;
  }

  /**
   * Traduce el campo penetracionCategoria (string) a un valor numérico
   * de penetración (P122) entre 0 y 1.
   *
   * - Si viene vacío/undefined → lanza BadRequestException.
   * - Si viene un número/porcentaje → lo parsea.
   * - Si viene una etiqueta (facil/medio/dificil) → usa un mapa básico.
   */
  private mapPenetracionCategoria(raw?: string): number {
    if (!raw) {
      throw new BadRequestException(
        'penetracionCategoria es requerida para calcular rendimiento',
      );
    }

    const value = raw.trim().toLowerCase();

    // Si viene algo numérico (ej. "0.8" o "80%"), lo intentamos parsear
    const numericCandidate = Number(value.replace('%', ''));
    if (!Number.isNaN(numericCandidate) && numericCandidate > 0) {
      // Si es > 1 asumimos que viene como porcentaje ("80" = 80 %)
      return numericCandidate > 1 ? numericCandidate / 100 : numericCandidate;
    }

    // Map básico por etiqueta descriptiva
    switch (value) {
      case 'facil':
      case 'fácil':
        return 0.85; // TODO: ajustar a tus rangos reales (80–100 %, etc.)
      case 'medio':
        return 0.6;
      case 'dificil':
      case 'difícil':
        return 0.35;
      default:
        throw new BadRequestException(
          `penetracionCategoria inválida: "${raw}". Debe ser un valor numérico o uno de: facil | medio | dificil`,
        );
    }
  }

  /**
   * Construye los parámetros globales que usa la fórmula de rendimiento
   * (P120, P121, P122, P123, P124, P125, P126, Q126).
   *
   * Aquí se concentran los "constantes" de Casa por casa / Nacional.
   * Se valida que los campos requeridos no vengan undefined.
   */
  private buildParamsRendimiento(
    dto: CreateCotizacionDto | UpdateCotizacionDto,
  ): ParamsRendimiento {
    // Validar que tengamos duración de cuestionario
    if (
      dto.duracionCuestionarioMin === null ||
      dto.duracionCuestionarioMin === undefined
    ) {
      throw new BadRequestException(
        'duracionCuestionarioMin es requerida para calcular rendimiento',
      );
    }

    // Validar que tengamos encuestadores totales
    if (
      dto.encuestadoresTotales === null ||
      dto.encuestadoresTotales === undefined ||
      dto.encuestadoresTotales <= 0
    ) {
      throw new BadRequestException(
        'encuestadoresTotales debe ser mayor que 0 para calcular rendimiento',
      );
    }

    // Validar/mapping de penetración
    const penetracion = this.mapPenetracionCategoria(
      dto.penetracionCategoria,
    );

    return {
      // P120 - duración cuestionario en minutos (input del cliente)
      duracionCuestionarioMin: dto.duracionCuestionarioMin,

      // P122 - penetración como fracción (0.80 = 80 %)
      penetracion,

      // Q126 - Encuestadores totales
      totalEncuestadores: dto.encuestadoresTotales,

      // Valores fijos según tu Excel para:
      // Casa por casa, cobertura Nacional
      segmentSize: 20,        // P124: tamaño de segmento
      filterMinutes: 2,       // P121: duración del filtro
      searchMinutes: 8,       // P123: tiempo de búsqueda
      desplazamientoMin: 60,  // P125: min de desplazamiento
      groupSize: 4,           // para P126 = ROUND(Q126 / 4, 0)
    };
  }

  // ---------------------------------------------------------------------------
  // Casos de uso públicos
  // ---------------------------------------------------------------------------

  /**
   * Punto de entrada principal para crear una cotización.
   * Aquí se guardan los datos base y, según la cobertura,
   * se llama al "motor" para empezar a calcular la lógica del Excel.
   */
  async create(dto: CreateCotizacionDto, createdById: number) {
    // 1) Verifica que exista el proyecto
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    const code = await this.generateCotizacionCode(dto.projectId);

    // 2) Crea la cotización con los inputs base
    //    dto.totalEntrevistas = Ingresar!H4 (total que da el cliente)
    const cotizacion = await this.prisma.cotizacion.create({
      data: {
        projectId: dto.projectId,
        code,
        createdById,
        status: 'draft', // por defecto

        totalEntrevistas: dto.totalEntrevistas,
        duracionCuestionarioMin: dto.duracionCuestionarioMin,
        tipoEntrevista: dto.tipoEntrevista,
        penetracionCategoria: dto.penetracionCategoria,
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

    // 3) Lógica específica según cobertura
    //    De momento solo trabajamos con la cobertura "Nacional"
    const coberturaLower = dto.cobertura.trim().toLowerCase();

    if (coberturaLower === 'nacional') {
      // 3.1 Distribuye las entrevistas por departamento
      const distribucion = distribuirEntrevistasNacional(
        dto.totalEntrevistas,
        dto.tipoEntrevista,
      );

      // 3.2 Calcula rendimiento por departamento
      const paramsRendimiento = this.buildParamsRendimiento(dto);
      const distribucionConRendimiento = aplicarRendimientoNacional(
        distribucion,
        paramsRendimiento,
      );

      // 3.3 Calcula encuestadores y supervisores por departamento
      //      usando Q126 = dto.encuestadoresTotales
      const distribucionConPersonal =
        aplicarEncuestadoresYSupervisoresNacional(
          distribucionConRendimiento,
          dto.encuestadoresTotales,
          {
            groupSize: 4,       // para P126 = ROUND(Q126/4,0)
            supervisorSplit: 4, // supervisores por fila = P126 / 4
          },
        );

      // 3.4 Calcula Días campo Encuest y asigna precios unitarios
      //     de viáticos, transporte y hotel
      const distribucionFinal = aplicarDiasCampoYCostosNacional(
        distribucionConPersonal,
      );

      // distribucionFinal.filas ahora contiene, por depto:
      //  - urbano, rural, total
      //  - horasEfectivas, tiempoEfectivoMin
      //  - rendimiento
      //  - encuestadores, supervisores
      //  - diasCampoEncuest
      //  - viaticosUnit, tMicrobusUnit, hotelUnit
      //
      // distribucionFinal.totalDiasCampoEncuestGlobal
      // representa la suma a nivel nacional (fila TOTAL).
      //
      // TODO (siguiente etapa):
      // - Usar distribucionFinal para construir CotizacionItem:
      //   * TRABAJO DE CAMPO (Días campo, pago encuestadores, pago supervisores)
      //   * Viáticos totales por departamento
      //   * Transporte, hotel, etc.
      // - Guardar esos items en la tabla cotizacionItem.
      //
      // Por ahora solo integramos el motor, sin persistir aún
      // estos detalles en la BD.
      void distribucionFinal;
    }

    // 4) Devolvemos la cotización con la info actual
    return this.findOne(cotizacion.id);
  }

  /**
   * Devuelve una cotización con su proyecto, cliente y detalle de items.
   */
  async findOne(id: number) {
    const cot = await this.prisma.cotizacion.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        status: true,
        project: {
          select: {
            id: true,
            name: true,
            projectType: true,
            studyType: true,
            cliente: {
              select: {
                id: true,
                empresa: true,
                razonSocial: true,
              },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true, lastName: true },
        },
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
        factorComisionablePct: true,
        factorNoComisionablePct: true,
        totalCobrar: true,
        costoPorEntrevista: true,
        items: {
          orderBy: { orden: 'asc' },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!cot) throw new NotFoundException('Cotización no encontrada');
    return cot;
  }

  /**
   * Lista cotizaciones por proyecto.
   */
  async findAllByProject(projectId: number) {
    return this.prisma.cotizacion.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        code: true,
        status: true,
        totalEntrevistas: true,
        totalCobrar: true,
        costoPorEntrevista: true,
        createdAt: true,
        createdBy: {
          select: { id: true, name: true, lastName: true },
        },
      },
    });
  }

  /**
   * Actualiza inputs de la cotización y (más adelante) recalcula todo.
   */
  async update(id: number, dto: UpdateCotizacionDto, userId: number) {
    const current = await this.prisma.cotizacion.findUnique({
      where: { id },
      select: { id: true, status: true, createdById: true },
    });
    if (!current) throw new NotFoundException('Cotización no encontrada');

    // Regla de negocio: no permitir cambios si está aprobada o rechazada
    if (['aprobado', 'rechazado'].includes(current.status)) {
      throw new BadRequestException(
        'No se puede editar una cotización aprobada o rechazada',
      );
    }

    // Opcional: solo el creador puede editar
    if (current.createdById !== userId) {
      throw new ForbiddenException(
        'Solo el usuario que creó la cotización puede actualizarla',
      );
    }

    const updated = await this.prisma.cotizacion.update({
      where: { id },
      data: dto,
    });

    // TODO:
    // - Cuando implementemos el recálculo en update, aquí deberíamos
    //   volver a llamar al motor (distribuir, rendimiento, días, etc.)
    return this.findOne(updated.id);
  }

  /**
   * Actualiza solo el estado de la cotización.
   */
  async updateStatus(
    id: number,
    dto: UpdateCotizacionStatusDto,
    userId: number,
  ) {
    const current = await this.prisma.cotizacion.findUnique({
      where: { id },
      select: { id: true, status: true, createdById: true },
    });
    if (!current) throw new NotFoundException('Cotización no encontrada');

    // Aquí podrías validar roles específicos para aprobar/rechazar.
    // Por ahora permitimos al creador cambiar el estado.
    if (current.createdById !== userId) {
      throw new ForbiddenException(
        'Solo el usuario que creó la cotización puede cambiar su estado',
      );
    }

    return this.prisma.cotizacion.update({
      where: { id },
      data: { status: dto.status },
      select: {
        id: true,
        code: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Clona una cotización (solo si está aprobada).
   * Crea una nueva cotización con mismo contenido e items, pero status = draft.
   */
  async clone(id: number, userId: number) {
    const cot = await this.prisma.cotizacion.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!cot) throw new NotFoundException('Cotización no encontrada');

    if (cot.status !== 'aprobado') {
      throw new BadRequestException(
        'Solo se pueden clonar cotizaciones en estado aprobado',
      );
    }

    const code = await this.generateCotizacionCode(cot.projectId);

    const clone = await this.prisma.$transaction(async (tx) => {
      const nueva = await tx.cotizacion.create({
        data: {
          projectId: cot.projectId,
          code,
          status: 'draft',
          createdById: userId, // quien la clona pasa a ser el creador

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

      // Clona los items si existen
      if (cot.items.length > 0) {
        await tx.cotizacionItem.createMany({
          data: cot.items.map((it) => ({
            cotizacionId: nueva.id,
            category: it.category,
            description: it.description,
            personas: it.personas,
            dias: it.dias,
            costoUnitario: it.costoUnitario,
            costoTotal: it.costoTotal,
            comisionable: it.comisionable,
            totalConComision: it.totalConComision,
            orden: it.orden,
          })),
        });
      }

      return nueva;
    });

    return this.findOne(clone.id);
  }

  /**
   * Elimina una cotización (si no está aprobada) y solo si la borra
   * el mismo usuario que la creó.
   */
  async remove(id: number, userId: number) {
    const cot = await this.prisma.cotizacion.findUnique({
      where: { id },
      select: { id: true, status: true, createdById: true },
    });
    if (!cot) throw new NotFoundException('Cotización no encontrada');

    if (cot.createdById !== userId) {
      throw new ForbiddenException(
        'Solo el usuario que creó la cotización puede eliminarla',
      );
    }

    // Regla de negocio opcional: no borrar si está aprobada
    if (cot.status === 'aprobado') {
      throw new BadRequestException(
        'No se puede eliminar una cotización aprobada',
      );
    }

    await this.prisma.cotizacion.delete({ where: { id } });
    return { deleted: true };
  }
}
