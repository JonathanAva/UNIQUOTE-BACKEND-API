import { AuthGuard } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

// Guard que protege rutas exigiendo un JWT válido usando la estrategia 'jwt'
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
