import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// DTO para crear un rol nuevo
export class CreateRoleDto {
  @ApiProperty({ example: 'administrador' })
  @IsString()
  @IsNotEmpty()
  name: string; // Nombre del rol
}
