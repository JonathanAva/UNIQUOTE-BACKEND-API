import { PartialType } from '@nestjs/swagger';
import { CreateContactoDto } from './create-contacto.dto';

// DTO para actualizar un contacto de empresa (todos los campos opcionales)
export class UpdateContactoDto extends PartialType(CreateContactoDto) {}
