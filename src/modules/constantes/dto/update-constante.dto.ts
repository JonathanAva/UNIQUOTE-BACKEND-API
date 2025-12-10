import { PartialType } from '@nestjs/swagger';
import { CreateConstanteDto } from './create-constante.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export enum CategoriaConstante {
  TRABAJO_DE_CAMPO = 'trabajo_de_campo',
  RECURSOS = 'recursos',
  DIRECCION = 'direccion',
  PROCESAMIENTO = 'procesamiento',
}

export class UpdateConstanteDto extends PartialType(CreateConstanteDto) {
  @ApiPropertyOptional({
    example: 'trabajo_de_campo',
    enum: CategoriaConstante,
    description: 'Categoría principal de la constante',
  })
  @IsEnum(CategoriaConstante)
  @IsOptional()
  categoria?: CategoriaConstante;

  @ApiPropertyOptional({
    example: 'viaticos.Ahuachapan',
    description: 'Subcategoría específica a modificar',
  })
  @IsString()
  @IsOptional()
  subcategoria?: string;

  @ApiPropertyOptional({
    example: 6.0,
    description: 'Nuevo valor numérico de la constante',
  })
  @IsNumber()
  @IsOptional()
  valor?: number;
}
