import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ description: 'ID del cliente dueño del proyecto', example: 1 })
  @IsInt()
  clienteId: number;

  @ApiProperty({
    description: 'ID del contacto del cliente (opcional)',
    example: 10,
    required: false,
  })
  @IsOptional()
  @IsInt()
  contactoId?: number;

  @ApiProperty({
    description: 'Nombre del proyecto',
    example: 'Estudio Casa por casa noviembre 2025',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Tipo de proyecto / entrevista',
    example: 'Casa por casa',
  })
  @IsString()
  @IsNotEmpty()
  projectType: string;

  @ApiProperty({
    description: 'Tipo de estudio',
    example: 'Cuantitativo',
  })
  @IsString()
  @IsNotEmpty()
  studyType: string;
}
