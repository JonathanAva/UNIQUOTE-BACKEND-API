import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

// DTO de actualización del usuario (todos los campos opcionales)
export class UpdateUserDto extends PartialType(CreateUserDto) {}
