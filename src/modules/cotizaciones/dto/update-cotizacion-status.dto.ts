// src/modules/cotizaciones/dto/update-cotizacion-status.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { CotizacionStatus } from '@prisma/client';

export class UpdateCotizacionStatusDto {
  @ApiProperty({
    enum: CotizacionStatus,
    description: 'Nuevo estado de la cotización',
    example: CotizacionStatus.NEGOCIACION,
  })
  @IsEnum(CotizacionStatus)
  status: CotizacionStatus;
}
