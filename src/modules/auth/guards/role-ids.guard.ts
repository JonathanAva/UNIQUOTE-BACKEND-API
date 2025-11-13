import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// Guard que verifica si el usuario autenticado tiene un roleId permitido
// según los valores definidos en el decorador @RoleIds()
@Injectable()
export class RoleIdsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Lee los roleIds configurados en el handler o en la clase
    const allowed = this.reflector.getAllAndOverride<number[]>('roleIds', [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si no hay restricciones de rol, se permite el acceso
    if (!allowed || allowed.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;

    // Si no hay usuario o no tiene roleId numérico, se deniega
    if (!user || typeof user.roleId !== 'number') return false;

    // Permite solo si el roleId del usuario está en la lista permitida
    return allowed.includes(user.roleId);
  }
}
