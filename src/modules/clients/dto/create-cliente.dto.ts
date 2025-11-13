import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// DTO para crear un nuevo cliente (empresa)
export class CreateClienteDto {
  @ApiProperty({ example: 'UNIMER S.A. de C.V.' })
  @IsString()
  @IsNotEmpty()
  empresa: string; // Nombre comercial de la empresa

  @ApiProperty({ example: 'UNIMER INVESTIGACIÓN DE MERCADOS' })
  @IsString()
  @IsNotEmpty()
  razonSocial: string; // Razón social legal
}
