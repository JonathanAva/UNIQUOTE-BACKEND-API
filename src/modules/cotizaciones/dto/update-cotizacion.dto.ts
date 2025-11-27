// src/modules/cotizaciones/dto/update-cotizacion.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateCotizacionDto } from './create-cotizacion.dto';

export class UpdateCotizacionDto extends PartialType(CreateCotizacionDto) {}
