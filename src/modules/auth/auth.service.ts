// src/modules/auth/auth.service.ts
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
import { randomInt } from 'node:crypto';

const MINUTES = (n: number) => n * 60 * 1000;
const DAYS = (n: number) => n * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly mfaTtlMin: number;
  private readonly mfaWindowDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailer: MailerService,
    private readonly config: ConfigService,
  ) {
    this.mfaTtlMin = parseInt(this.config.get<string>('MFA_CODE_TTL_MIN') ?? '10', 10);
    this.mfaWindowDays = parseInt(this.config.get<string>('MFA_WINDOW_DAYS') ?? '29', 10);
  }

  // --- Helpers ---
  private needsMfa(lastVerifiedAt?: Date | null): boolean {
    if (!lastVerifiedAt) return true;
    return Date.now() - lastVerifiedAt.getTime() > DAYS(this.mfaWindowDays);
  }

  private generateNumericCode(length = 6): string {
    const n = randomInt(0, 10 ** length);
    return n.toString().padStart(length, '0');
  }

  private async createAndSendOtp(userId: number, email: string) {
    const code = this.generateNumericCode(6);
    const codeHash = await argon2.hash(code);
    const expiresAt = new Date(Date.now() + MINUTES(this.mfaTtlMin));

    // Limpia códigos previos
    await this.prisma.emailOtp.deleteMany({ where: { userId } });

    await this.prisma.emailOtp.create({
      data: { userId, codeHash, expiresAt },
    });

    const html = this.mailer.buildOtpEmail(code, this.mfaTtlMin);
    await this.mailer.sendEmail(email, 'Código de verificación', html);
  }

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
      roleId: user.roleId,     
      role: user.role.name,   
    };
    return this.jwtService.sign(payload);
  }

  // --- Public API ---
  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });

    if (!user || !(await argon2.verify(user.password, password))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return user;
  }

  // LOGIN: si requiere MFA, envía OTP y no devuelve token
  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);

    if (this.needsMfa(user.mfaLastVerifiedAt)) {
      await this.createAndSendOtp(user.id, user.email);
      return { requiresMfa: true, message: `Se envió un código a ${user.email}` };
    }

    const accessToken = this.signAccessToken(user);
    return { accessToken };
  }

  // VERIFICAR OTP
  async verifyEmailCode(dto: VerifyEmailCodeDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { role: true },
    });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    const record = await this.prisma.emailOtp.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw new BadRequestException('Código no encontrado, solicita uno nuevo');

    if (record.expiresAt.getTime() < Date.now()) {
      await this.prisma.emailOtp.deleteMany({ where: { userId: user.id } });
      throw new BadRequestException('Código expirado, solicita uno nuevo');
    }

    const ok = await argon2.verify(record.codeHash, dto.code);
    if (!ok) throw new BadRequestException('Código inválido');

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { mfaLastVerifiedAt: new Date() },
      }),
      this.prisma.emailOtp.deleteMany({ where: { userId: user.id } }),
    ]);

    const accessToken = this.signAccessToken(user);
    return { accessToken };
  }

  
  async resendEmailCode(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    await this.createAndSendOtp(user.id, user.email);
    return { sent: true };
  }
}
