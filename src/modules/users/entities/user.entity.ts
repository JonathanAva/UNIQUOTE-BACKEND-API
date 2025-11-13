// Entidad de dominio para representar un usuario (útil si se quiere desacoplar de Prisma)
export class UserEntity {
  id: number;
  name: string;
  lastName: string;
  email: string;
  phone: string;
  role: {
    id: number;
    name: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
