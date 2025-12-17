// src/modules/constantes/constantes.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infra/database/prisma.service';
import { CreateConstanteDto } from './dto/create-constante.dto';
import { UpdateConstanteDto } from './dto/update-constante.dto';
import { AuditoriaService } from '@/modules/auditoria/auditoria.service';

@Injectable()
export class ConstantesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async create(dto: CreateConstanteDto, performedById: number) {
    const created = await this.prisma.constante.create({
      data: dto,
    });

    await this.auditoria.log({
      accion: 'CREAR_CONSTANTE',
      descripcion: `Creó constante "${created.categoria}.${created.subcategoria}" = ${created.valor}`,
      entidad: 'CONSTANTE',
      entidadId: created.id,
      performedById,
      metadata: { after: created },
    });

    return created;
  }

  async findAll() {
    return this.prisma.constante.findMany({
      orderBy: { categoria: 'asc' },
    });
  }

  async findOne(id: number) {
    const constante = await this.prisma.constante.findUnique({
      where: { id },
    });
    if (!constante) {
      throw new NotFoundException('Constante no encontrada');
    }
    return constante;
  }

  async update(id: number, dto: UpdateConstanteDto, performedById: number) {
    const existente = await this.prisma.constante.findUnique({
      where: { id },
    });

    if (!existente) {
      throw new NotFoundException('Constante no encontrada');
    }

    const updated = await this.prisma.constante.update({
      where: { id },
      data: dto,
    });

    await this.auditoria.log({
      accion: 'EDITAR_CONSTANTE',
      descripcion: `Editó constante "${updated.categoria}.${updated.subcategoria}"`,
      entidad: 'CONSTANTE',
      entidadId: updated.id,
      performedById,
      metadata: {
        before: existente,
        after: updated,
        changes: dto,
      },
    });

    return updated;
  }

  async findByCategoria(nombre: string) {
    const constantes = await this.prisma.constante.findMany({
      where: {
        categoria: nombre,
      },
      orderBy: {
        subcategoria: 'asc',
      },
      select: {
        id: true,
        subcategoria: true,
        valor: true,
        unidad: true,
      },
    });

    if (!constantes.length) {
      throw new NotFoundException(
        `No se encontraron constantes en la categoría "${nombre}"`,
      );
    }

    return constantes;
  }

  async findBySubcategoria(nombre: string) {
    const constantes = await this.prisma.constante.findMany({
      where: {
        subcategoria: {
          contains: nombre,
          mode: 'insensitive',
        },
      },
      orderBy: {
        categoria: 'asc',
      },
      select: {
        id: true,
        categoria: true,
        subcategoria: true,
        valor: true,
        unidad: true,
      },
    });

    if (!constantes.length) {
      throw new NotFoundException(
        `No se encontraron constantes con la subcategoría que contenga "${nombre}"`,
      );
    }

    return constantes;
  }

  async remove(id: number, performedById: number) {
    const existe = await this.prisma.constante.findUnique({
      where: { id },
    });

    if (!existe) {
      throw new NotFoundException('Constante no encontrada');
    }

    await this.prisma.constante.delete({
      where: { id },
    });

    await this.auditoria.log({
      accion: 'ELIMINAR_CONSTANTE',
      descripcion: `Eliminó constante "${existe.categoria}.${existe.subcategoria}"`,
      entidad: 'CONSTANTE',
      entidadId: existe.id,
      performedById,
      metadata: { deleted: existe },
    });

    return { message: 'Constante eliminada correctamente' };
  }

  async getAllAsKeyValue(): Promise<Record<string, number>> {
    const constantes = await this.prisma.constante.findMany();

    const record: Record<string, number> = {};
    for (const c of constantes) {
      const key = `${c.categoria}.${c.subcategoria}`;
      record[key] = c.valor;
    }

    return record;
  }
}
