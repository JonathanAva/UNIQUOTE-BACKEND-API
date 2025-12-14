// src/modules/cotizaciones/dto/update-cotizacion-item.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional } from 'class-validator';

export class UpdateCotizacionItemDto {
  @ApiPropertyOptional({ type: Number, description: 'Personas' })
  @IsOptional() @IsNumber()
  personas?: number | null;

  @ApiPropertyOptional({ type: Number, description: 'Días' })
  @IsOptional() @IsNumber()
  dias?: number | null;

  @ApiPropertyOptional({ type: Number, description: 'Costo unitario' })
  @IsOptional() @IsNumber()
  costoUnitario?: number | null;

  @ApiPropertyOptional({ type: Number, description: 'Costo total (base, sin comisión)' })
  @IsOptional() @IsNumber()
  costoTotal?: number | null;

  @ApiPropertyOptional({ type: Boolean, description: '¿Es comisionable?' })
  @IsOptional() @IsBoolean()
  comisionable?: boolean;

  @ApiPropertyOptional({ type: Number, description: 'Total con comisión (override)' })
  @IsOptional() @IsNumber()
  totalConComision?: number | null;
}
