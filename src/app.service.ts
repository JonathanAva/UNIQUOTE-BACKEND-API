import { Injectable } from '@nestjs/common';

@Injectable()
// Servicio simple usado por AppController para el endpoint raíz
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
