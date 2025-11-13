import { PartialType } from '@nestjs/swagger';
import { CreateCotizacionDto } from './create-cotizacion.dto';

// Permite actualizar inputs de la cotización
export class UpdateCotizacionDto extends PartialType(CreateCotizacionDto) {}
