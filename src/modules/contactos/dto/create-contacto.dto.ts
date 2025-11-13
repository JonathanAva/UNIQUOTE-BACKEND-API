import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// DTO para crear un contacto de empresa
export class CreateContactoDto {
  @ApiProperty({ example: '1', description: 'ID del cliente dueño del contacto' })
  @IsNotEmpty()
  clienteId: number; // ID del Cliente (empresa) al cual pertenece este contacto

  @ApiProperty({ example: 'Giovanni Flores' })
  @IsString()
  @IsNotEmpty()
  nombre: string; // Nombre del contacto

  @ApiProperty({ example: 'giovanni@empresa.com' })
  @IsEmail()
  email: string; // Correo del contacto (único/global según el schema)

  @ApiProperty({ example: '+503 7777-7777' })
  @IsString()
  @IsNotEmpty()
  telefono: string; // Teléfono del contacto
}
