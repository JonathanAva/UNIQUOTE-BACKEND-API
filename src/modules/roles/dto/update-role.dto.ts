import { PartialType } from '@nestjs/swagger';
import { CreateRoleDto } from './create-role.dto';

// DTO para actualizar un rol (todas las propiedades opcionales)
export class UpdateRoleDto extends PartialType(CreateRoleDto) {}
