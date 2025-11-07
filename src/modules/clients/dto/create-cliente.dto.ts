import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateClienteDto {
  @ApiProperty({ example: 'UNIMER S.A. de C.V.' })
  @IsString()
  @IsNotEmpty()
  empresa: string;

  @ApiProperty({ example: 'UNIMER INVESTIGACIÓN DE MERCADOS' })
  @IsString()
  @IsNotEmpty()
  razonSocial: string;
}
