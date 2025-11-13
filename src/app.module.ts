// src/app.module.ts
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';

import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClientesModule } from './modules/clients/clientes.module';
import { ContactosModule } from './modules/contactos/contactos.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { CotizacionesModule } from './modules/cotizaciones/cotizaciones.module';



// Módulo raíz que importa y compone todos los demás módulos de la app
@Module({
  imports: [
    // Logger estructurado usando pino
    LoggerModule.forRoot({
      pinoHttp: {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      },
    }),
    // Módulo de configuración global (variables de entorno)
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    // Módulos de negocio
    UsersModule,
    RolesModule,
    AuthModule,
    ClientesModule,
    ContactosModule,
    ProjectsModule,
    CotizacionesModule,
  ],
})
export class AppModule {}
