import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RoleIdsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<number[]>('roleIds', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!allowed || allowed.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user || typeof user.roleId !== 'number') return false;

    return allowed.includes(user.roleId);
  }
}
