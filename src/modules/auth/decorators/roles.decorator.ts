import { SetMetadata } from '@nestjs/common';

// Decorador para asociar roles por nombre (string).
// No se está usando en los guards actuales, pero queda disponible.
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

// Decorador para asociar IDs numéricos de roles permitidos al handler.
export const RoleIds = (...roleIds: number[]) => SetMetadata('roleIds', roleIds);
