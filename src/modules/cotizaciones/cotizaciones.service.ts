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

@Injectable()
export class CotizacionesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Genera un código simple de cotización dentro de un proyecto.
   * Ej: COT-<projectId>-<secuencia>
   */
  private async generateCotizacionCode(projectId: number): Promise<string> {
    const count = await this.prisma.cotizacion.count({
      where: { projectId },
    });
    const seq = count + 1;
    return `COT-${projectId}-${seq}`;
  }

  /**
   * Punto de entrada principal para crear una cotización.
   * Más adelante aquí llamaremos a la lógica que replica el Excel
   * para llenar items y totales.
   */
  async create(dto: CreateCotizacionDto, createdById: number) {
    // Verifica que exista el proyecto
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    const code = await this.generateCotizacionCode(dto.projectId);

    // Crea la cotización con los inputs base
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

    // TODO: aquí iremos agregando la lógica de:
    // - calcular items (Trabajo de campo, Recursos, Dirección, Procesamiento, etc.)
    // - calcular totalCobrar y costoPorEntrevista
    // Por ahora, solo devolvemos la cotización básica.
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

    // TODO: cuando tengamos las fórmulas, aquí llamamos a una función
    // privada que recalcula items + totales.
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
   * Crea una nueva cotización con mismo contenido e items, pero status=draft.
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

      // clona los items si existen
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
