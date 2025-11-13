import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaService } from '@/infra/database/prisma.service';
import { AppMailerModule } from '@/shared/mailer/mailer.module';

// Módulo de autenticación (login + MFA + JWT)
@Module({
  imports: [
    ConfigModule,
    AppMailerModule, // Módulo para envío de correos (MFA)
    // Configuración de Passport con estrategia JWT por defecto
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // Configuración del módulo JWT de forma asíncrona usando ConfigService
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('jwt.secret'), // clave para firmar tokens
        signOptions: { expiresIn: '1d' }, // tiempo de vida de los tokens de acceso
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PrismaService],
  exports: [JwtModule, PassportModule], // Exporta JWT y Passport para otros módulos si los necesitan
})
export class AuthModule {}
