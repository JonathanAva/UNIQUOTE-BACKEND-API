import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

// DTO para validar el código de verificación enviado por correo (MFA)
export class VerifyEmailCodeDto {
  @ApiProperty({
    example: 'usuario@empresa.com',
    description: 'Correo con el que el usuario inició sesión',
  })
  @IsEmail()
  email: string; // email del usuario al que se le envió el código

  @ApiProperty({
    example: '123456',
    description: 'Código numérico de 6 dígitos enviado al correo',
  })
  @IsString()
  @Length(6, 6)
  code: string; // código OTP ingresado por el usuario
}
