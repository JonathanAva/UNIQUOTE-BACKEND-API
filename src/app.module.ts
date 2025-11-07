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

@Module({
  imports: [
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
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    UsersModule,
    RolesModule,
    AuthModule, 
    ClientesModule,
    ContactosModule,
  ],
})
export class AppModule {}
