import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class UpdateCotizacionStatusDto {
  @ApiProperty({
    description: 'Nuevo estado de la cotización',
    example: 'aprobado',
    enum: ['draft', 'en_revision', 'aprobado', 'rechazado'],
  })
  @IsString()
  @IsIn(['draft', 'en_revision', 'aprobado', 'rechazado'])
  status: string;
}
