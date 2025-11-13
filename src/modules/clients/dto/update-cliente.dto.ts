import { PartialType } from '@nestjs/swagger';
import { CreateClienteDto } from './create-cliente.dto';

// DTO de actualización: todas las propiedades son opcionales
export class UpdateClienteDto extends PartialType(CreateClienteDto) {}
