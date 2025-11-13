import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

// Controlador raíz de la aplicación (ruta "/")
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Endpoint simple para verificar que la app responde
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
