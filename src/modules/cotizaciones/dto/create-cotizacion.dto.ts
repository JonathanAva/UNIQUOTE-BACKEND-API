import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
  IsNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Enum de tipos de estudio disponibles en la empresa
 */
export enum StudyTypeEnum {
  CUALITATIVO = 'Cualitativo',
  CUANTITATIVO = 'Cuantitativo',
}

/**
 * Enum de metodologías cualitativas soportadas
 */
export enum MetodologiaEnum {
  CASA_POR_CASA = 'Casa por casa',
  CENTRO_COMERCIAL = 'Centro comercial',
  MYSTERY_SHOPPER = 'Mysteri shopper',
  ONLINE = 'Online',
  PUNTO_AFLUENCIA = 'Punto de afluencia',
  TELEFONICO = 'Telefonico',
}

/**
 * Enum para el tipo de trabajo de campo
 */
export enum TrabajoDeCampoTipo {
  PROPIO = 'propio',
  SUBCONTRATADO = 'subcontratado',
}

/**
 * DTO para crear una cotización nueva dentro de un proyecto
 */
export class CreateCotizacionDto {
  @ApiProperty({ example: 1, description: 'ID del proyecto asociado a la cotización' })
  @IsInt()
  projectId: number;

  @ApiProperty({ example: 3, required: false, description: 'ID del contacto dentro del cliente (opcional)' })
  @IsOptional()
  @IsInt()
  contactoId?: number;

  @ApiProperty({ example: 'Cotización Pizza Hawaiana 2025', description: 'Nombre de la cotización' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    enum: StudyTypeEnum,
    example: StudyTypeEnum.CUALITATIVO,
    description: 'Tipo de estudio: Cualitativo o Cuantitativo',
  })
  @IsString()
  @IsNotEmpty()
  studyType: string;

  @ApiProperty({
    enum: MetodologiaEnum,
    required: false,
    example: MetodologiaEnum.CASA_POR_CASA,
    description: 'Metodología usada si el estudio es cualitativo',
  })
  @IsOptional()
  @IsString()
  metodologia?: string;

  // 🔽 Trabajo de campo
  @ApiProperty({
    example: true,
    description: '¿Se realizará trabajo de campo?',
  })
  @IsBoolean()
  trabajoDeCampoRealiza: boolean;

  @ApiProperty({
    example: TrabajoDeCampoTipo.PROPIO,
    enum: TrabajoDeCampoTipo,
    required: false,
    description: 'Tipo de trabajo de campo: "propio" o "subcontratado"',
  })
  @ValidateIf((o) => o.trabajoDeCampoRealiza === true)
  @IsEnum(TrabajoDeCampoTipo)
  trabajoDeCampoTipo?: TrabajoDeCampoTipo;

  @ApiProperty({
    example: 0,
    required: false,
    description: 'Costo total del trabajo de campo (solo si es subcontratado)',
  })
  @ValidateIf((o) => o.trabajoDeCampoTipo === TrabajoDeCampoTipo.SUBCONTRATADO)
  @IsNumber()
  @Min(1)
  trabajoDeCampoCosto?: number;

  @ApiProperty({
    example: 2,
    required: false,
    description: 'Número de olas BI para informe (opcional, por defecto 2)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  numeroOlasBi?: number;

  @ApiProperty({ example: 1000, description: 'Número total de entrevistas o encuestas' })
  @IsInt()
  @Min(1)
  totalEntrevistas: number;

  @ApiProperty({ example: 10, description: 'Duración del cuestionario en minutos' })
  @IsInt()
  @Min(1)
  duracionCuestionarioMin: number;

  @ApiProperty({ example: 'Casa por casa', description: 'Tipo de entrevista realizada' })
  @IsString()
  tipoEntrevista: string;

  @ApiProperty({ example: 100, description: 'Penetración de la categoría en porcentaje' })
  @IsInt()
  @Min(1)
  @Max(100)
  penetracionCategoria: string | number;

  @ApiProperty({ example: 'Nacional', description: 'Cobertura del estudio' })
  @IsString()
  cobertura: string;

  @ApiProperty({ example: 8, description: 'Número total de supervisores asignados' })
  @IsInt()
  supervisores: number;

  @ApiProperty({ example: 30, description: 'Número total de encuestadores requeridos' })
  @IsInt()
  encuestadoresTotales: number;

  @ApiProperty({ example: true, description: '¿La empresa realiza el cuestionario?' })
  @IsBoolean()
  realizamosCuestionario: boolean;

  @ApiProperty({ example: true, description: '¿La empresa realiza el script?' })
  @IsBoolean()
  realizamosScript: boolean;

  @ApiProperty({ example: true, description: '¿El cliente solicita reporte de resultados?' })
  @IsBoolean()
  clienteSolicitaReporte: boolean;

  @ApiProperty({ example: true, description: '¿El cliente solicita un informe BI?' })
  @IsBoolean()
  clienteSolicitaInformeBI: boolean;

  @ApiProperty({
    example: 0,
    required: false,
    description: 'Incentivo económico por entrevista (opcional)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  incentivoTotal?: number;
}
