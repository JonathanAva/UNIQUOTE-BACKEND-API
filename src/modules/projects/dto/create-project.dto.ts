// src/modules/cotizaciones/projects/dto/create-project.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({
    description: 'ID del cliente dueño del proyecto',
    example: 1,
  })
  @IsInt()
  clienteId: number;

  @ApiProperty({
    description:
      'ID del contacto principal asociado al proyecto (opcional)',
    example: 3,
    required: false,
  })
  @IsOptional()
  @IsInt()
  contactoId?: number;

  @ApiProperty({
    description: 'Nombre del proyecto',
    example: 'Pizza Alegría – Estudio Casa por casa 2025',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Tipo de proyecto / tipo de entrevista',
    example: 'Casa por casa',
  })
  @IsString()
  @IsNotEmpty()
  projectType: string;

  @ApiProperty({
    description: 'Tipo de estudio (Cuantitativo, Cualitativo, etc.)',
    example: 'Cuantitativo',
  })
  @IsString()
  @IsNotEmpty()
  studyType: string;
}
