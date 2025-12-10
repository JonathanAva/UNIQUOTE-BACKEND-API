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

  async findByCategoria(categoria: string) {
  return this.prisma.constante.findMany({
    where: {
      categoria: {
        equals: categoria,
        mode: 'insensitive', // Opcional: ignora mayúsculas/minúsculas
      },
    },
    orderBy: {
      subcategoria: 'asc',
    },
  });
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
