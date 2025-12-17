// src/modules/auditoria/auditoria.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/infra/database/prisma.service';
import { Prisma } from '@prisma/client';

export type AuditoriaLogInput = {
  accion: string;
  descripcion: string;
  entidad: string;
  entidadId?: number | null;
  cotizacionId?: number | null;
  performedById: number;
  metadata?: unknown; // ✅ ahora acepta DTOs/clases sin pelear con TS
};

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    // Convierte clases/DTOs/Date/etc a JSON plano (sin prototype)
    // Date se convierte a ISO automáticamente por JSON.stringify
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  async log(input: AuditoriaLogInput) {
    return this.prisma.auditoria.create({
      data: {
        accion: input.accion,
        descripcion: input.descripcion,
        entidad: input.entidad,
        entidadId: input.entidadId ?? null,
        cotizacionId: input.cotizacionId ?? null,
        performedById: input.performedById,
        metadata:
          input.metadata === undefined ? undefined : this.toJsonValue(input.metadata),
      },
      select: { id: true, createdAt: true },
    });
  }

  async findAll(params?: {
    skip?: number;
    take?: number;
    entidad?: string;
    entidadId?: number;
    cotizacionId?: number;
    performedById?: number;
  }) {
    const skip = Math.max(0, Number(params?.skip ?? 0));
    const take = Math.min(200, Math.max(1, Number(params?.take ?? 50)));

    return this.prisma.auditoria.findMany({
      where: {
        entidad: params?.entidad ?? undefined,
        entidadId: params?.entidadId ?? undefined,
        cotizacionId: params?.cotizacionId ?? undefined,
        performedById: params?.performedById ?? undefined,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      select: {
        id: true,
        accion: true,
        descripcion: true,
        entidad: true,
        entidadId: true,
        cotizacionId: true,
        metadata: true,
        createdAt: true,
        performedBy: {
          select: { id: true, name: true, lastName: true, email: true },
        },
      },
    });
  }
}
