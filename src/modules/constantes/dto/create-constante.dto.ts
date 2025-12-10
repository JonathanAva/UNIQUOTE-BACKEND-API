import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export enum CategoriaConstante {
  TRABAJO_DE_CAMPO = 'trabajo_de_campo',
  RECURSOS = 'recursos',
  DIRECCION = 'direccion',
  PROCESAMIENTO = 'procesamiento',
}

export class CreateConstanteDto {
  @ApiProperty({
    example: 'trabajo_de_campo',
    enum: CategoriaConstante,
    description: 'Categoría principal de la constante',
  })
  @IsEnum(CategoriaConstante)
  categoria: CategoriaConstante;

  @ApiProperty({
    example: 'viaticos.Ahuachapan',
    description: 'Subcategoría específica, puede incluir el nombre del departamento o recurso',
  })
  @IsString()
  @IsNotEmpty()
  subcategoria: string;

  @ApiProperty({
    example: 6.0,
    description: 'Valor numérico de la constante',
  })
  @IsNumber()
  valor: number;
}
