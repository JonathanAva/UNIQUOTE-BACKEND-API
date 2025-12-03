import { PartialType } from '@nestjs/swagger';
import { CreateCotizacionDto } from './create-cotizacion.dto';

/**
 * DTO para actualizar una cotización.
 * 
 * Hereda todas las propiedades de CreateCotizacionDto,
 * pero las vuelve opcionales automáticamente.
 * 
 * Ideal para PATCH o PUT porque Swagger muestra todos los campos,
 * y Nest validation pipe permite enviar solo los que deseas actualizar.
 */
export class UpdateCotizacionDto extends PartialType(CreateCotizacionDto) {}
