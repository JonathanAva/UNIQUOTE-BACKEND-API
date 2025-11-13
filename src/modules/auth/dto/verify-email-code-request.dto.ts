import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { VerifyEmailCodeDto } from './verify-email-code.dto';

// DTO que extiende VerifyEmailCodeDto agregando la opción de recordar dispositivo
export class VerifyEmailCodeRequestDto extends VerifyEmailCodeDto {
  @ApiProperty({
    description: 'Si se marca, este navegador se marca como dispositivo de confianza (30 días)',
    required: false,
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  rememberDevice?: boolean; // indica si se debe registrar el dispositivo como confiable
}
