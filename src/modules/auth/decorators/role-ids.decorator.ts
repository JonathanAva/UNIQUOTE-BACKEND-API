import { SetMetadata } from '@nestjs/common';

// Decorador para asociar IDs de rol permitidos a un handler/controlador.
// Se usa junto con RoleIdsGuard para proteger endpoints por roleId numérico.
export const RoleIds = (...roleIds: number[]) => SetMetadata('roleIds', roleIds);
