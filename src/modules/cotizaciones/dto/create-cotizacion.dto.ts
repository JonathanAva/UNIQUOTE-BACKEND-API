// src/modules/cotizaciones/dto/create-cotizacion.dto.ts
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCotizacionDto {
  @ApiProperty({
    description: 'ID del proyecto al que pertenece la cotización',
    example: 1,
  })
  @IsInt()
  projectId: number;

  @ApiProperty({
    description: 'Nombre amigable de la cotización',
    example: 'Ola 1 – Casa por casa noviembre',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description:
      'ID del contacto de la empresa asociado a esta cotización (opcional)',
    example: 3,
    required: false,
  })
  @IsOptional()
  @IsInt()
  contactoId?: number;

  @ApiProperty({
    description: 'Total de entrevistas del estudio',
    example: 1050,
  })
  @IsInt()
  @Min(1)
  totalEntrevistas: number;

  @ApiProperty({
    description: 'Duración del cuestionario en minutos',
    example: 15,
  })
  @IsInt()
  @Min(1)
  duracionCuestionarioMin: number;

  @ApiProperty({
    description: 'Tipo de entrevista',
    example: 'Casa por casa',
  })
  @IsString()
  @IsNotEmpty()
  tipoEntrevista: string;

  @ApiProperty({
    description: 'Penetración de la categoría',
    example: 'facil',
    enum: ['facil', 'medio', 'dificil'],
  })
  @IsString()
  @IsNotEmpty()
  penetracionCategoria: string;

  @ApiProperty({
    description: 'Cobertura seleccionada (Nacional, Urbano, AMSS, etc.)',
    example: 'Nacional',
  })
  @IsString()
  @IsNotEmpty()
  cobertura: string;

  @ApiProperty({
    description: 'Cantidad de supervisores',
    example: 8,
  })
  @IsInt()
  @Min(0)
  supervisores: number;

  @ApiProperty({
    description: 'Cantidad total de encuestadores',
    example: 30,
  })
  @IsInt()
  @Min(0)
  encuestadoresTotales: number;

  @ApiProperty({
    description: '¿UNIMER realiza el cuestionario?',
    example: true,
  })
  @IsBoolean()
  realizamosCuestionario: boolean;

  @ApiProperty({
    description: '¿UNIMER realiza el script?',
    example: false,
  })
  @IsBoolean()
  realizamosScript: boolean;

  @ApiProperty({
    description: '¿Cliente solicita reporte?',
    example: true,
  })
  @IsBoolean()
  clienteSolicitaReporte: boolean;

  @ApiProperty({
    description: '¿Cliente solicita informe BI?',
    example: true,
  })
  @IsBoolean()
  clienteSolicitaInformeBI: boolean;

  @ApiProperty({
    description:
      'Número de olas para BI (base 2, si es 3 significa una ola extra)',
    example: 2,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(2)
  numeroOlasBi?: number;

  @ApiProperty({
    description: 'Monto total de incentivos (opcional)',
    example: 1000,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  incentivoTotal?: number;
}
