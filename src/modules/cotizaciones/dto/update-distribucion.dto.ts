// src/modules/cotizaciones/dto/update-distribucion.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  Validate,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

/** Lista cerrada (enum) para los departamentos soportados por la tabla NACIONAL */
export const DEPARTAMENTOS = [
  'Ahuachapán',
  'Santa Ana',
  'Sonsonate',
  'Chalatenango',
  'La Libertad',
  'San Salvador',
  'Cuscatlán',
  'La Paz',
  'Cabañas',
  'San Vicente',
  'Usulután',
  'San Miguel',
  'Morazán',
  'La Unión',
] as const;
export type DepartamentoNacional = typeof DEPARTAMENTOS[number];

/* ----------------------------- Helpers transform ----------------------------- */

/** Convierte strings numéricos a number conservando null/undefined */
const toNumber = () =>
  Transform(({ value }) => {
    if (value === '' || value === null || value === undefined) return undefined;
    if (typeof value === 'string') {
      const v = value.replace(',', '.').trim();
      const n = Number(v);
      return Number.isFinite(n) ? n : value; // deja que class-validator lo marque si no es número
    }
    return value;
  });

/* -------------------------- Validadores personalizados ------------------------- */

/**
 * Verifica que al menos un campo override (aparte de `departamento`)
 * haya sido enviado en la fila.
 */
@ValidatorConstraint({ name: 'AtLeastOneOverrideField', async: false })
class AtLeastOneOverrideField implements ValidatorConstraintInterface {
  validate(row: any) {
    const keys: (keyof DistribucionRowOverrideDto)[] = [
      'urbano',
      'rural',
      'total',
      'horasEfectivas',
      'tiempoEfectivoMin',
      'rendimiento',
      'encuestadores',
      'supervisores',
      'diasCampoEncuest',
      'viaticosUnit',
      'tMicrobusUnit',
      'hotelUnit',
      'precioBoleta',
    ];
    return keys.some((k) => row[k] !== null && row[k] !== undefined);
  }
  defaultMessage(_args?: ValidationArguments) {
    return 'Debe enviar al menos un campo para modificar en cada fila.';
  }
}

/**
 * Si se envían `total`, `urbano` y `rural` a la vez, valida que total = urbano + rural.
 * Si falta alguno, no valida consistencia (se asume cálculo server-side).
 */
@ValidatorConstraint({ name: 'ConsistentTotals', async: false })
class ConsistentTotals implements ValidatorConstraintInterface {
  validate(row: any) {
    const hasTotal = row.total !== undefined && row.total !== null;
    const hasU = row.urbano !== undefined && row.urbano !== null;
    const hasR = row.rural !== undefined && row.rural !== null;
    if (hasTotal && hasU && hasR) {
      return Number(row.total) === Number(row.urbano) + Number(row.rural);
    }
    return true;
  }
  defaultMessage(_args?: ValidationArguments) {
    return 'Inconsistencia: total debe ser igual a urbano + rural cuando se envían los tres campos.';
  }
}

/* ---------------------------------- DTOs ---------------------------------- */

export class DistribucionRowOverrideDto {
  @ApiProperty({
    enum: DEPARTAMENTOS,
    description:
      'Departamento a modificar. Debe coincidir con los nombres usados por la tabla NACIONAL.',
    example: 'San Miguel',
  })
  @IsIn(DEPARTAMENTOS as unknown as string[], {
    message: 'departamento inválido',
  })
  departamento!: DepartamentoNacional;

  // --- Asignación de entrevistas ---
  @ApiPropertyOptional({
    description: 'Entrevistas en zona urbana (entero ≥ 0).',
    example: 53,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  urbano?: number;

  @ApiPropertyOptional({
    description: 'Entrevistas en zona rural (entero ≥ 0).',
    example: 34,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  rural?: number;

  @ApiPropertyOptional({
    description:
      'Entrevistas totales del departamento (entero ≥ 0). Si envías urbano y rural, debe cumplir total = urbano + rural.',
    example: 87,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  total?: number;

  // --- Jornada / tiempo ---
  @ApiPropertyOptional({
    description: 'Horas efectivas por día para el departamento (entero ≥ 0).',
    example: 6,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  horasEfectivas?: number;

  @ApiPropertyOptional({
    description: 'Minutos efectivos por día (entero ≥ 0).',
    example: 360,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  tiempoEfectivoMin?: number;

  // --- Productividad / dotación ---
  @ApiPropertyOptional({
    description:
      'Rendimiento (entrevistas por encuestador por día). Número ≥ 0.',
    example: 2.67,
  })
  @IsOptional()
  @toNumber()
  @IsNumber()
  @Min(0)
  rendimiento?: number;

  @ApiPropertyOptional({
    description: 'Número de encuestadores asignados (entero ≥ 0).',
    example: 8,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  encuestadores?: number;

  @ApiPropertyOptional({
    description: 'Número de supervisores asignados (entero ≥ 0).',
    example: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  supervisores?: number;

  @ApiPropertyOptional({
    description: 'Días de campo (encuestadores) en el departamento (≥ 0).',
    example: 1.25,
  })
  @IsOptional()
  @toNumber()
  @IsNumber()
  @Min(0)
  diasCampoEncuest?: number;

  // --- Precios unitarios (viáticos / transporte / hotel) ---
  @ApiPropertyOptional({
    description: 'Viáticos unitarios por persona y día (USD ≥ 0).',
    example: 10,
  })
  @IsOptional()
  @toNumber()
  @IsNumber()
  @Min(0)
  viaticosUnit?: number;

  @ApiPropertyOptional({
    description:
      'Costo unitario de transporte (microbús) por día (USD ≥ 0).',
    example: 180,
  })
  @IsOptional()
  @toNumber()
  @IsNumber()
  @Min(0)
  tMicrobusUnit?: number;

  @ApiPropertyOptional({
    description: 'Costo unitario de hotel por persona y día (USD ≥ 0).',
    example: 12,
  })
  @IsOptional()
  @toNumber()
  @IsNumber()
  @Min(0)
  hotelUnit?: number;

  // --- Precio de boleta ---
  @ApiPropertyOptional({
    description:
      'Precio de boleta para el departamento (USD ≥ 0). Si no se envía, se calculará con la tabla por penetración/duración.',
    example: 3.5,
  })
  @IsOptional()
  @toNumber()
  @IsNumber()
  @Min(0)
  precioBoleta?: number;
}

/**
 * DTO de actualización por lotes de la tabla de distribución (por cotización).
 * - Requiere al menos una fila.
 * - Cada fila debe especificar un departamento válido y **al menos un** campo a modificar.
 * - Si se envían `total`, `urbano` y `rural` juntos en una fila, deben ser coherentes.
 */
export class UpdateDistribucionDto {
  @ApiProperty({
    type: [DistribucionRowOverrideDto],
    description:
      'Listado de filas a modificar. Cada fila apunta a un departamento y sobreescribe sólo los campos enviados.',
    example: [
      {
        departamento: 'San Miguel',
        urbano: 60,
        rural: 40,
        total: 100,
        rendimiento: 2.5,
        viaticosUnit: 10,
        tMicrobusUnit: 180,
        hotelUnit: 12,
      },
      {
        departamento: 'La Libertad',
        diasCampoEncuest: 1.8,
        supervisores: 2,
      },
    ],
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'Debe enviar al menos una fila en "rows".' })
  @ValidateNested({ each: true })
  @Type(() => DistribucionRowOverrideDto)
  @Validate(AtLeastOneOverrideField, {
    each: true,
    message: 'Cada fila debe incluir al menos un campo a modificar.',
  })
  @Validate(ConsistentTotals, {
    each: true,
  })
  rows!: DistribucionRowOverrideDto[];
}
