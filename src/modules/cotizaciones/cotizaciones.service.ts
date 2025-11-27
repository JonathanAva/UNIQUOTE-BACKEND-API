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

// Builder para "Casa por casa"
import { buildCotizacionCasaPorCasa } from './builder/casa-por-casa.builder';

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

  // ---------------------------------------------------------------------------
  // Casos de uso públicos
  // ---------------------------------------------------------------------------

  /**
   * Punto de entrada principal para crear una cotización.
   */
  async create(dto: CreateCotizacionDto, createdById: number) {
    // 1) Verifica que exista el proyecto y obtenemos el cliente
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { id: true, clienteId: true },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    // 2) Si viene contactoId, validar que pertenezca al cliente del proyecto
    if (dto.contactoId) {
      const contacto = await this.prisma.contactoEmpresa.findFirst({
        where: {
          id: dto.contactoId,
          clienteId: project.clienteId,
        },
        select: { id: true },
      });
      if (!contacto) {
        throw new NotFoundException(
          'El contacto no pertenece al cliente del proyecto',
        );
      }
    }

    const code = await this.generateCotizacionCode(dto.projectId);

    // 3) Crea la cotización con los inputs base
    const cotizacion = await this.prisma.cotizacion.create({
      data: {
        projectId: dto.projectId,
        contactoId: dto.contactoId ?? null,
        name: dto.name,
        code,
        createdById,
        status: CotizacionStatus.ENVIADO, // estado inicial

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

    // 4) Delegar a builder según tipo de entrevista
    const tipoEntrevistaLower = dto.tipoEntrevista.trim().toLowerCase();

    if (tipoEntrevistaLower === 'casa por casa') {
      const buildResult = buildCotizacionCasaPorCasa({
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
        numeroOlasBi: dto.numeroOlasBi ?? 2,
      });

      // TODO: Persistir buildResult.items en CotizacionItem y actualizar totales.
      void buildResult;
    }

    // 5) Devolvemos la cotización con la info actual
    return this.findOne(cotizacion.id);
  }

  /**
   * Devuelve una cotización con su proyecto, cliente, contacto y detalle.
   */
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
        contacto: {
          select: { id: true, nombre: true, email: true, telefono: true },
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

    // No permitir cambios si está aprobada o no aprobada
    if (
      current.status === CotizacionStatus.APROBADO ||
      current.status === CotizacionStatus.NO_APROBADO
    ) {
      throw new BadRequestException(
        'No se puede editar una cotización aprobada o no aprobada',
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

    void updated; // placeholder para cuando recalcules con builder
    return this.findOne(id);
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
        name: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Clona una cotización (solo si está aprobada).
   */
  async clone(id: number, userId: number) {
    const cot = await this.prisma.cotizacion.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!cot) throw new NotFoundException('Cotización no encontrada');

    if (cot.status !== CotizacionStatus.APROBADO) {
      throw new BadRequestException(
        'Solo se pueden clonar cotizaciones en estado APROBADO',
      );
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

    if (cot.status === CotizacionStatus.APROBADO) {
      throw new BadRequestException(
        'No se puede eliminar una cotización aprobada',
      );
    }

    await this.prisma.cotizacion.delete({ where: { id } });
    return { deleted: true };
  }
}
