import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateContactoDto {
  @ApiProperty({ example: '1', description: 'ID del cliente dueño del contacto' })
  @IsNotEmpty()
  clienteId: number;

  @ApiProperty({ example: 'Giovanni Flores' })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({ example: 'giovanni@empresa.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '+503 7777-7777' })
  @IsString()
  @IsNotEmpty()
  telefono: string;
}
