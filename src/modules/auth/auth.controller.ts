// src/modules/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  Get,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { VerifyEmailCodeDto } from './dto/verify-email-code.dto';
import { VerifyEmailCodeRequestDto } from './dto/verify-email-code-request.dto';
import { LoginDto } from './dto/login.dto';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { Request, Response } from 'express';
import { SetInitialPasswordDto } from './dto/set-initial-password.dto'; // ✅ NUEVO

// Grupo de endpoints relacionados a autenticación
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Endpoint de login (email + contraseña)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sesión con email y contraseña' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Delegamos toda la lógica de login/mfa al servicio
    return this.authService.login(dto, req, res);
  }

  // ✅ NUEVO: establecer la contraseña inicial (cuando mustChangePassword = true)
  @Post('set-initial-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Establecer contraseña inicial (token de un solo uso devuelto por /auth/login cuando password temporal)',
  })
  async setInitialPassword(@Body() dto: SetInitialPasswordDto) {
    return this.authService.setInitialPassword(dto);
  }

  // Endpoint para verificar el código de email (MFA)
  @Post('verify-email-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verificar código de inicio de sesión enviado por email',
  })
  async verifyEmailCode(
    @Body() dto: VerifyEmailCodeRequestDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.verifyEmailCode(dto, req, res);
  }

  // Endpoint para reenviar el código de verificación al email
  @Post('resend-email-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reenviar código de verificación por email' })
  async resendEmailCode(@Body('email') email: string) {
    return this.authService.resendEmailCode(email);
  }

  // Endpoint para obtener la info del usuario autenticado (basada en el token)
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  @Get('inf')
  @ApiOperation({ summary: 'Obtener información del usuario autenticado' })
  @ApiOkResponse({ description: 'Devuelve los datos del usuario logueado' })
  async me(@Req() req: Request) {
    // req.user es llenado por JwtStrategy.validate()
    return req.user;
  }
}
