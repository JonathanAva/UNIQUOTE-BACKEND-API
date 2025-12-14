import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsString, MinLength } from 'class-validator';

export class SetInitialPasswordDto {
  @ApiProperty({
    description:
      'Token de un solo uso devuelto por /auth/login cuando mustChangePassword=true',
  })
  @IsJWT()
  token: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
