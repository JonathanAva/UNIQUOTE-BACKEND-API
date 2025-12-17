import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '@/infra/database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as argon2 from 'argon2';
import { AuditoriaService } from '@/modules/auditoria/auditoria.service';
import { Prisma } from '@prisma/client';

@Injectable()
// Servicio que contiene la lógica de negocio para usuarios
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Convierte cualquier objeto (DTO, Date, etc.) a JSON válido para Prisma Json.
   * Evita el error TS de InputJsonValue.
   */
  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  async create(data: CreateUserDto, performedById: number) {
    // Verifica si ya existe un usuario con ese email
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('El correo electrónico ya está registrado');
    }

    // Hashea la contraseña antes de guardar
    const hashedPassword = await argon2.hash(data.password);

    try {
      const created = await this.prisma.user.create({
        data: {
          ...data,
          password: hashedPassword,
          mustChangePassword: true, // ← marcar para forzar cambio en primer login
          passwordChangedAt: null,
        },
        select: {
          id: true,
          name: true,
          lastName: true,
          email: true,
          phone: true,
          role: { select: { id: true, name: true } },
          mustChangePassword: true,
          createdAt: true,
        },
      });

      // ✅ Auditoría: crear usuario (sin guardar password en metadata)
      await this.auditoria.log({
        accion: 'CREAR_USUARIO',
        descripcion: `Creó usuario "${created.name} ${created.lastName}" (${created.email})`,
        entidad: 'USER',
        entidadId: created.id,
        performedById,
        metadata: this.toJson({
          after: created,
          inputs: {
            name: data.name,
            lastName: data.lastName,
            email: data.email,
            phone: data.phone,
            roleId: (data as any).roleId,
          },
        }),
      });

      return created;
    } catch (error) {
      // Manejo genérico de errores de base de datos
      throw new InternalServerErrorException('Error al crear el usuario');
    }
  }

  async findAll() {
    // Lista todos los usuarios con su rol asociado
    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        phone: true,
        role: {
          select: { id: true, name: true },
        },
        createdAt: true,
      },
    });
  }

  async findOne(id: number) {
    // Busca un usuario por ID con rol
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        phone: true,
        role: {
          select: { id: true, name: true },
        },
        createdAt: true,
      },
    });

    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async update(id: number, data: UpdateUserDto, performedById: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        phone: true,
        roleId: true,
        mustChangePassword: true,
        passwordChangedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    // Si cambia email, validar unicidad
    if (data.email && data.email !== user.email) {
      const dup = await this.prisma.user.findUnique({
        where: { email: data.email },
        select: { id: true },
      });
      if (dup) throw new ConflictException('El correo electrónico ya está registrado');
    }

    // Si viene nueva contraseña, se hashea antes de guardar
    let passwordWasUpdated = false;
    if (data.password) {
      data.password = await argon2.hash(data.password);
      passwordWasUpdated = true;

      // Opcional: si un admin resetea password, puedes forzar cambio en login
      // (descomenta si quieres ese comportamiento)
      // (data as any).mustChangePassword = true;
      // (data as any).passwordChangedAt = null;
    }

    // Actualiza y devuelve datos clave
    const updated = await this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        phone: true,
        role: {
          select: { id: true, name: true },
        },
        mustChangePassword: true,
        updatedAt: true,
      },
    });

    // ✅ Auditoría: editar usuario (sin exponer password/hash)
    const changesSafe: Record<string, any> = { ...data } as any;
    if ('password' in changesSafe) delete changesSafe.password;

    await this.auditoria.log({
      accion: 'EDITAR_USUARIO',
      descripcion: `Editó usuario "${updated.name} ${updated.lastName}" (${updated.email})`,
      entidad: 'USER',
      entidadId: updated.id,
      performedById,
      metadata: this.toJson({
        before: user,
        after: updated,
        changes: changesSafe,
        passwordUpdated: passwordWasUpdated,
      }),
    });

    return updated;
  }

  async remove(id: number, performedById: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        phone: true,
        role: { select: { id: true, name: true } },
        createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    // Elimina el registro de usuario
    await this.prisma.user.delete({ where: { id } });

    // ✅ Auditoría: eliminar usuario
    await this.auditoria.log({
      accion: 'ELIMINAR_USUARIO',
      descripcion: `Eliminó usuario "${user.name} ${user.lastName}" (${user.email})`,
      entidad: 'USER',
      entidadId: user.id,
      performedById,
      metadata: this.toJson({
        deleted: user,
      }),
    });

    return { deleted: true };
  }
}
