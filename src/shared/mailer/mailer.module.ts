import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MailerService } from './mailer.service';

// Módulo que expone el servicio de correo (MailerService)
@Module({
  imports: [ConfigModule],
  providers: [MailerService],
  exports: [MailerService],
})
export class AppMailerModule {}
