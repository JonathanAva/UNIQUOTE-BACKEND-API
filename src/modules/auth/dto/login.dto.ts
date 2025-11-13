// src/modules/auth/dto/login.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// DTO para el endpoint de login con email y contraseña
export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email: string; // Correo del usuario

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string; // Contraseña sin hashear (se valida contra el hash en BD)
}
