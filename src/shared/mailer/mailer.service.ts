import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

@Injectable()
// Servicio encargado de enviar correos usando Nodemailer
export class MailerService {
  private transporter: nodemailer.Transporter;
  private from: string;
  private readonly logger = new Logger(MailerService.name);

  constructor(private readonly config: ConfigService) {
    // Lectura de configuración SMTP desde variables de entorno
    const host = this.config.get<string>('SMTP_HOST');
    const port = parseInt(this.config.get<string>('SMTP_PORT') ?? '587', 10);
    const secure = (this.config.get<string>('SMTP_SECURE') ?? 'false') === 'true';
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    // Si no especificas EMAIL_FROM, usa el mismo del usuario autenticado
    this.from = this.config.get<string>('EMAIL_FROM') || user || 'no-reply@example.com';

    // Crea el transport de Nodemailer
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,                         // true para 465, false para 587
      auth: { user, pass },           // Credenciales SMTP
      logger: true,                   // logs de nodemailer en consola
      debug: true,                    // más detalle en consola
      requireTLS: !secure,            // fuerza STARTTLS si va por 587
      tls: {
        // En dev a veces conviene permitir self-signed; en prod se recomienda quitarlo
        rejectUnauthorized: false,
      },
    });
  }

  // Envía un correo HTML al destinatario indicado
  async sendEmail(to: string, subject: string, html: string) {
    try {
      // opcional: verifica conexión/credenciales antes de enviar
      // await this.transporter.verify();

      await this.transporter.sendMail({
        from: this.from, // IMPORTANTE: muchos SMTP exigen que sea igual a SMTP_USER
        to,
        subject,
        html,
      });
    } catch (err: any) {
      // deja registro claro en logs
      this.logger.error(err?.message || err);
      throw new InternalServerErrorException('MAILER_AUTH_FAILED');
    }
  }

  // Construye el template HTML del correo que contiene el código OTP
  buildOtpEmail(code: string, minutes: number) {
    return `
      <div style="font-family:Arial,Helvetica,sans-serif">
        <h2>Tu código de verificación</h2>
        <p>Usa este código para completar tu inicio de sesión:</p>
        <p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p>
        <p>Este código expira en <b>${minutes} minutos</b>.</p>
        <p>Si no fuiste tú, ignora este correo.</p>
      </div>
    `;
  }
}
