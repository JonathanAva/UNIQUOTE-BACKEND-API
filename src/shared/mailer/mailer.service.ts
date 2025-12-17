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
      secure, // true para 465, false para 587
      auth: { user, pass }, // Credenciales SMTP

      // ✅ Recomendación: en PROD ponelo en false para no generar logs extra
      logger: true,
      debug: true,

      requireTLS: !secure, // fuerza STARTTLS si va por 587
      tls: {
        // En dev a veces conviene permitir self-signed; en prod se recomienda quitarlo
        rejectUnauthorized: false,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  // Escape básico para evitar que algo raro rompa el HTML
  private escapeHtml(input: any) {
    return String(input ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Fallback simple HTML -> text (para deliverability)
  private htmlToTextFallback(html: string) {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h\d>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // Valores de marca/empresa desde env (con defaults sobrios)
  private getBrand() {
    const appName = this.config.get<string>('APP_NAME') ?? 'UNIQUOTE';
    const brandColor = this.config.get<string>('BRAND_COLOR') ?? '#0F2A43'; // azul corporativo
    const brandLogoUrl = this.config.get<string>('BRAND_LOGO_URL') ?? ''; // opcional

    const companyName = this.config.get<string>('COMPANY_NAME') ?? appName;
    const website = this.config.get<string>('COMPANY_WEBSITE') ?? '';
    const address = this.config.get<string>('COMPANY_ADDRESS') ?? '';
    const supportEmail = this.config.get<string>('SUPPORT_EMAIL') ?? 'soporte@uniquote.com';

    return { appName, brandColor, brandLogoUrl, companyName, website, address, supportEmail };
  }

  // ---------------------------------------------------------------------------
  // Envío
  // ---------------------------------------------------------------------------

  // Envía un correo HTML al destinatario indicado (con texto plano opcional)
  async sendEmail(to: string, subject: string, html: string, text?: string) {
    try {
      await this.transporter.sendMail({
        from: this.from, // IMPORTANTE: muchos SMTP exigen que sea igual a SMTP_USER
        to,
        subject,
        html,
        text: text ?? this.htmlToTextFallback(html),
      });
    } catch (err: any) {
      this.logger.error(err?.message || err);
      throw new InternalServerErrorException('MAILER_AUTH_FAILED');
    }
  }

  // ---------------------------------------------------------------------------
  // Templates
  // ---------------------------------------------------------------------------

  /**
   * Template corporativo de OTP:
   * - Diseño sobrio, header limpio, bloque de código destacado, footer legal.
   * - Compatible con Gmail/Outlook (tablas + inline CSS).
   */
  buildOtpEmail(code: string, minutes: number) {
    const { appName, brandColor, brandLogoUrl, companyName, website, address, supportEmail } =
      this.getBrand();

    const safeCode = this.escapeHtml(code);
    const safeMinutes = Number.isFinite(Number(minutes)) ? Number(minutes) : 5;

    // Preheader: texto oculto (preview de Gmail)
    const preheader = `Código de verificación: ${safeCode}. Expira en ${safeMinutes} minutos.`;

    const year = new Date().getFullYear();

    // Logo opcional: si no hay URL, usamos nombre en texto
    const logoBlock = brandLogoUrl
      ? `
        <img
          src="${this.escapeHtml(brandLogoUrl)}"
          width="140"
          alt="${this.escapeHtml(companyName)}"
          style="display:block;border:0;outline:none;text-decoration:none;height:auto;max-width:140px;"
        />
      `
      : `
        <div style="font-size:16px;font-weight:700;letter-spacing:0.3px;color:#111827;">
          ${this.escapeHtml(companyName)}
        </div>
      `;

    const websiteBlock = website
      ? `<a href="${this.escapeHtml(website)}" style="color:${brandColor};text-decoration:none;">${this.escapeHtml(
          website,
        )}</a>`
      : '';

    const addressBlock = address ? `<div style="margin-top:6px;">${this.escapeHtml(address)}</div>` : '';

    return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${this.escapeHtml(appName)} - Verificación</title>
  </head>

  <body style="margin:0;padding:0;background-color:#F5F7FA;">
    <!-- Preheader (oculto) -->
    <div style="display:none;font-size:1px;color:#F5F7FA;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
      ${this.escapeHtml(preheader)}
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#F5F7FA;padding:28px 0;">
      <tr>
        <td align="center" style="padding:0 14px;">

          <!-- Contenedor principal -->
          <table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0"
            style="width:100%;max-width:640px;background:#FFFFFF;border-radius:14px;overflow:hidden;box-shadow:0 12px 28px rgba(16,24,40,0.10);">

            <!-- Barra superior de marca -->
            <tr>
              <td style="height:6px;background:${brandColor};font-size:0;line-height:0;">&nbsp;</td>
            </tr>

            <!-- Header -->
            <tr>
              <td style="padding:22px 26px 14px 26px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td align="left" style="font-family:Arial,Helvetica,sans-serif;">
                      ${logoBlock}
                    </td>
                    <td align="right" style="font-family:Arial,Helvetica,sans-serif;">
                      <div style="font-size:12px;color:#6B7280;">
                        Notificación de seguridad
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Título -->
            <tr>
              <td style="padding:0 26px 8px 26px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
                <h2 style="margin:0;font-size:20px;line-height:28px;font-weight:700;">
                  Verificación de inicio de sesión
                </h2>
              </td>
            </tr>

            <!-- Cuerpo -->
            <tr>
              <td style="padding:0 26px 18px 26px;font-family:Arial,Helvetica,sans-serif;">
                <p style="margin:0 0 14px 0;font-size:14px;line-height:22px;color:#374151;">
                  Utilice el siguiente código para completar su verificación. Este código es confidencial.
                </p>

                <!-- Card del código -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
                  style="border:1px solid #E5E7EB;border-radius:12px;background:#FAFBFC;">
                  <tr>
                    <td style="padding:18px 16px;text-align:center;">
                      <div style="font-size:12px;color:#6B7280;margin-bottom:8px;">
                        Código de verificación
                      </div>
                      <div style="
                        display:inline-block;
                        padding:12px 16px;
                        border-radius:10px;
                        background:#FFFFFF;
                        border:1px solid #E5E7EB;
                        font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono','Courier New', monospace;
                        font-size:28px;
                        font-weight:800;
                        letter-spacing:6px;
                        color:#111827;">
                        ${safeCode}
                      </div>
                      <div style="font-size:12px;color:#6B7280;margin-top:10px;">
                        Válido por <b>${safeMinutes} minutos</b>.
                      </div>
                    </td>
                  </tr>
                </table>

                <!-- Nota -->
                <div style="margin-top:14px;padding:12px 14px;border-left:4px solid ${brandColor};background:#F8FAFC;border-radius:10px;">
                  <p style="margin:0;font-size:12px;line-height:18px;color:#475569;">
                    Si usted no solicitó este código, puede ignorar este mensaje. No comparta este código con nadie.
                  </p>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:14px 26px 22px 26px;font-family:Arial,Helvetica,sans-serif;">
                <hr style="border:none;border-top:1px solid #E5E7EB;margin:0 0 12px 0;" />
                <div style="font-size:12px;line-height:18px;color:#6B7280;">
                  Soporte: <a href="mailto:${this.escapeHtml(
                    supportEmail,
                  )}" style="color:${brandColor};text-decoration:none;">${this.escapeHtml(supportEmail)}</a>
                  ${websiteBlock ? `<span style="margin:0 8px;color:#CBD5E1;">|</span>${websiteBlock}` : ``}
                  ${addressBlock}
                </div>

                <div style="margin-top:10px;font-size:11px;line-height:16px;color:#9CA3AF;">
                  Este es un correo automático, por favor no responda a este mensaje.
                  <br />
                  © ${year} ${this.escapeHtml(companyName)}. Todos los derechos reservados.
                </div>
              </td>
            </tr>
          </table>

          <!-- Espacio final -->
          <div style="height:22px;line-height:22px;font-size:22px;">&nbsp;</div>

        </td>
      </tr>
    </table>
  </body>
</html>
    `.trim();
  }

  // Texto plano específico para OTP (recomendado)
  buildOtpText(code: string, minutes: number) {
    const { companyName, supportEmail, website } = this.getBrand();
    const safeMinutes = Number.isFinite(Number(minutes)) ? Number(minutes) : 5;

    return [
      `${companyName} - Verificación de inicio de sesión`,
      ``,
      `Código de verificación: ${code}`,
      `Válido por ${safeMinutes} minutos.`,
      ``,
      `Si usted no solicitó este código, ignore este mensaje.`,
      `Soporte: ${supportEmail}`,
      website ? `Sitio web: ${website}` : ``,
    ]
      .filter(Boolean)
      .join('\n');
  }
}
