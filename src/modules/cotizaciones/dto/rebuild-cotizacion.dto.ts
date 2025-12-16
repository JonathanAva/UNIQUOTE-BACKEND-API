import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { TrabajoDeCampoTipo } from './create-cotizacion.dto';

export class RebuildCotizacionDto {
  @ApiPropertyOptional({ example: 'Cotización AMSS (copia) v2' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 3, description: 'ID contacto (opcional)' })
  @IsOptional()
  @IsInt()
  contactoId?: number | null;

  @ApiPropertyOptional({ example: 'Cuantitativo' })
  @IsOptional()
  @IsString()
  studyType?: string;

  @ApiPropertyOptional({ example: 'Casa por casa' })
  @IsOptional()
  @IsString()
  metodologia?: string | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  trabajoDeCampoRealiza?: boolean;

  @ApiPropertyOptional({
    enum: TrabajoDeCampoTipo,
    example: TrabajoDeCampoTipo.PROPIO,
  })
  @IsOptional()
  trabajoDeCampoTipo?: TrabajoDeCampoTipo | null;

  @ApiPropertyOptional({ example: 5000, description: 'Solo si es subcontratado' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  trabajoDeCampoCosto?: number | null;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  numeroOlasBi?: number | null;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  totalEntrevistas?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  duracionCuestionarioMin?: number;

  @ApiPropertyOptional({ example: 'Casa por casa' })
  @IsOptional()
  @IsString()
  tipoEntrevista?: string;

  @ApiPropertyOptional({
    example: 0.6,
    description: '0–1 ó "60%" ó "fácil/medio/difícil"',
  })
  @IsOptional()
  penetracionCategoria?: string | number;

  @ApiPropertyOptional({ example: 'AMSS' })
  @IsOptional()
  @IsString()
  cobertura?: string;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsInt()
  @Min(0)
  supervisores?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  encuestadoresTotales?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  clienteSolicitaTablas?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  realizamosCuestionario?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  realizamosScript?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  clienteSolicitaReporte?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  clienteSolicitaInformeBI?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  incentivoTotal?: number | null;

  @ApiPropertyOptional({
    example: false,
    description:
      'Si true, conserva overrides de distribución. Default: false (se borran como “cotización nueva”).',
  })
  @IsOptional()
  @IsBoolean()
  keepDistribucionOverrides?: boolean;
}
