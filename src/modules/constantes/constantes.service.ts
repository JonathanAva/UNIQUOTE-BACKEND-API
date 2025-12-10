import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/infra/database/prisma.service';
import { CreateConstanteDto } from './dto/create-constante.dto';
import { UpdateConstanteDto } from './dto/update-constante.dto';

@Injectable()
export class ConstantesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateConstanteDto) {
    return this.prisma.constante.create({
      data: dto,
    });
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

  async update(id: number, dto: UpdateConstanteDto) {
    const existente = await this.prisma.constante.findUnique({
      where: { id },
    });

    if (!existente) {
      throw new NotFoundException('Constante no encontrada');
    }

    return this.prisma.constante.update({
      where: { id },
      data: dto,
    });
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
      throw new NotFoundException(`No se encontraron constantes en la categoría "${nombre}"`);
    }

    return constantes;
  }


async findBySubcategoria(nombre: string) {
  const constantes = await this.prisma.constante.findMany({
    where: {
      subcategoria: {
        contains: nombre,
        mode: 'insensitive', // ignora mayúsculas
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
    throw new NotFoundException(`No se encontraron constantes con la subcategoría que contenga "${nombre}"`);
  }

  return constantes;
}


  async remove(id: number) {
    const existe = await this.prisma.constante.findUnique({
      where: { id },
    });

    if (!existe) {
      throw new NotFoundException('Constante no encontrada');
    }

    await this.prisma.constante.delete({
      where: { id },
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
