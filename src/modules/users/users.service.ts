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

@Injectable()
// Servicio que contiene la lógica de negocio para usuarios
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateUserDto) {
    // Verifica si ya existe un usuario con ese email
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictException('El correo electrónico ya está registrado');
    }

    // Hashea la contraseña antes de guardar
    const hashedPassword = await argon2.hash(data.password);

    try {
      return await this.prisma.user.create({
        data: {
          ...data,
          password: hashedPassword,
        },
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

  async update(id: number, data: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    // Si viene nueva contraseña, se hashea antes de guardar
    if (data.password) {
      data.password = await argon2.hash(data.password);
    }

    // Actualiza y devuelve datos clave
    return this.prisma.user.update({
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
        updatedAt: true,
      },
    });
  }

  async remove(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    // Elimina el registro de usuario
    return this.prisma.user.delete({
      where: { id },
    });
  }
}
