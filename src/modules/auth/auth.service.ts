import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/infra/database/prisma.service';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailCodeDto } from './dto/verify-email-code.dto';
import * as argon2 from 'argon2';
import { MailerService } from '@/shared/mailer/mailer.service';
import { ConfigService } from '@nestjs/config';
import { randomInt, randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

// Helpers para convertir minutos/días a milisegundos
const MINUTES = (n: number) => n * 60 * 1000;
const DAYS = (n: number) => n * 24 * 60 * 60 * 1000;

@Injectable()
// Servicio que maneja la lógica de autenticación, MFA y dispositivos confiables
export class AuthService {
  // Tiempo de vida del código MFA en minutos
  private readonly mfaTtlMin: number;
  // Ventana de confiabilidad del dispositivo en días
  private readonly mfaWindowDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {
    // Lee la configuración de MFA desde variables de entorno (con valores por defecto)
    this.mfaTtlMin = parseInt(this.config.get<string>('MFA_CODE_TTL_MIN') ?? '10', 10);
    this.mfaWindowDays = parseInt(this.config.get<string>('MFA_WINDOW_DAYS') ?? '29', 10);
  }

  // ----------------- helpers -----------------

  // Determina si un usuario necesita MFA basado en la última verificación
  private needsMfa(lastVerifiedAt?: Date | null): boolean {
    if (!lastVerifiedAt) return true;
    return Date.now() - lastVerifiedAt.getTime() > DAYS(this.mfaWindowDays);
  }

  // Verifica si la confianza del dispositivo ya expiró
  private deviceTrustExpired(expiresAt: Date): boolean {
    return expiresAt.getTime() <= Date.now();
  }

  // Genera un código numérico OTP de N dígitos
  private generateNumericCode(length = 6): string {
    const n = randomInt(0, 10 ** length);
    return n.toString().padStart(length, '0');
  }

  // Obtiene (o crea) un device_id en cookie para identificar el dispositivo
  private getOrSetDeviceIdCookie(req: Request, res: Response): string {
    let deviceId = req.cookies?.['device_id'];
    if (!deviceId) {
      deviceId = randomUUID();
      // Cookie NO-HttpOnly, 1 año (para que el front pueda leer si lo necesita)
      res.cookie('device_id', deviceId, {
        httpOnly: false,
        sameSite: 'lax',
        secure: false, // en prod: true si usas HTTPS
        maxAge: 365 * 24 * 60 * 60 * 1000,
        path: '/',
      });
    }
    return deviceId;
  }

  // Crea cookie HttpOnly indicando que el dispositivo fue verificado (MFA)
  private setMfaTrustedCookie(res: Response, days: number) {
    res.cookie('mfa_trusted', '1', {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // en prod: true si usas HTTPS
      maxAge: days * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  // Elimina cookie de dispositivo confiable
  private clearMfaTrustedCookie(res: Response) {
    res.clearCookie('mfa_trusted', { path: '/' });
  }

  // Crea registro de OTP en BD, lo hashea y envía el correo al usuario
  private async createAndSendOtp(userId: number, email: string) {
    const code = this.generateNumericCode(6);
    const codeHash = await argon2.hash(code);
    const expiresAt = new Date(Date.now() + MINUTES(this.mfaTtlMin));

    // Elimina códigos anteriores del mismo usuario
    await this.prisma.emailOtp.deleteMany({ where: { userId } });
    // Crea nuevo código
    await this.prisma.emailOtp.create({
      data: { userId, codeHash, expiresAt },
    });

    const html = this.mailer.buildOtpEmail(code, this.mfaTtlMin);
    await this.mailer.sendEmail(email, 'Código de verificación', html);
  }

  // Firma un JWT a partir de los datos del usuario y su rol
  private signAccessToken(user: {
    id: number;
    email: string;
    name: string;
    lastName: string;
    phone: string;
    roleId: number;
    role: { name: string };
  }): string {
    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      lastName: user.lastName,
      phone: user.phone,
      roleId: user.roleId, // requerido por tu RoleIdsGuard
      role: user.role.name,
    };
    return this.jwtService.sign(payload);
  }

  // ----------------- core auth -----------------

  // Valida credenciales del usuario y devuelve el usuario con su rol
  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    // Si no existe o la contraseña no coincide, lanza error de Unauthorized
    if (!user || !(await argon2.verify(user.password, password))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return user;
  }

  /**
   * LOGIN:
   * - Valida credenciales
   * - Inspecciona device_id (cookie) y TrustedDevice
   * - Si confianza vigente -> NO MFA -> token
   * - Si no -> envia OTP y retorna MFA_REQUIRED
   */
  async login(dto: LoginDto, req: Request, res: Response) {
    const user = await this.validateUser(dto.email, dto.password);

    // Identificar (o crear) device_id del navegador
    const deviceId = this.getOrSetDeviceIdCookie(req, res);

    // Busca si ya hay un dispositivo confiable para este userId + deviceId
    const td = await this.prisma.trustedDevice.findUnique({
      where: { userId_deviceId: { userId: user.id, deviceId } },
    });

    // Si existe confianza vigente para (userId, deviceId) => NO pide MFA
    if (td && !this.deviceTrustExpired(td.expiresAt)) {
      const accessToken = this.signAccessToken(user);
      return { accessToken, trustedUntil: td.expiresAt.toISOString() };
    }

    // Si no hay confianza -> OTP por email y responde MFA_REQUIRED
    await this.createAndSendOtp(user.id, user.email);
    // Limpia cookie mfa_trusted (por si quedó vieja)
    this.clearMfaTrustedCookie(res);

    return { status: 'MFA_REQUIRED', message: `Se envió un código a ${user.email}` };
  }

  /**
   * VERIFY MFA:
   * - Valida OTP
   * - Si rememberDevice=true -> upsert TrustedDevice (30 días) + cookie HttpOnly
   * - Devuelve token 24h
   */
  async verifyEmailCode(
    dto: VerifyEmailCodeDto & { rememberDevice?: boolean },
    req: Request,
    res: Response,
  ) {
    // Busca usuario por email para aplicar validaciones
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { role: true },
    });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    // Toma el último código OTP generado para este usuario
    const record = await this.prisma.emailOtp.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw new BadRequestException('Código no encontrado, solicita uno nuevo');

    // Valida expiración del código
    if (record.expiresAt.getTime() < Date.now()) {
      await this.prisma.emailOtp.deleteMany({ where: { userId: user.id } });
      throw new BadRequestException('Código expirado, solicita uno nuevo');
    }

    // Compara código ingresado con el hash guardado
    const ok = await argon2.verify(record.codeHash, dto.code);
    if (!ok) throw new BadRequestException('Código inválido');

    // OTP OK -> marca verificación de MFA y limpia códigos
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { mfaLastVerifiedAt: new Date() },
      }),
      this.prisma.emailOtp.deleteMany({ where: { userId: user.id } }),
    ]);

    // Recibir (o crear) device_id y aplicar rememberDevice
    const deviceId = this.getOrSetDeviceIdCookie(req, res);

    if (dto.rememberDevice) {
      const expiresAt = new Date(Date.now() + DAYS(this.mfaWindowDays));
      // Crea o actualiza el dispositivo de confianza
      await this.prisma.trustedDevice.upsert({
        where: { userId_deviceId: { userId: user.id, deviceId } },
        update: { lastVerified: new Date(), expiresAt },
        create: {
          userId: user.id,
          deviceId,
          lastVerified: new Date(),
          expiresAt,
        },
      });

      // Cookie HttpOnly para que el browser “recuerde” que pasó MFA
      this.setMfaTrustedCookie(res, this.mfaWindowDays);
    } else {
      // Si NO quiere recordar, asegúrate de no dejar mfa_trusted
      this.clearMfaTrustedCookie(res);
    }

    // Genera token de acceso final
    const accessToken = this.signAccessToken(user);
    return { accessToken };
  }

  // Reenvía un nuevo código de verificación a un email dado
  async resendEmailCode(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    await this.createAndSendOtp(user.id, user.email);
    return { sent: true };
  }
}
