import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Estructura del payload que se firma en el JWT
type JwtPayload = {
  sub: number;     // ID del usuario
  email: string;
  name: string;
  lastName: string;
  phone: string;
  roleId: number;  // ID numérico del rol
  role: string;    // Nombre del rol
};

@Injectable()
// Estrategia JWT que valida tokens Bearer y rellena req.user
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly config: ConfigService) {
    super({
      // Se intenta extraer el token del header Authorization y/o de cookies
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => req?.cookies?.access_token, // opcional si guardas el token en cookie
      ]),
      ignoreExpiration: false, // NO ignorar expiración, si está vencido, es inválido
      secretOrKey: config.getOrThrow<string>('jwt.secret'), // clave para verificar firma
    });
  }

  // Se ejecuta si la firma y expiración del token son válidas.
  // Lo que retornes aquí será lo que se tenga en req.user.
  async validate(payload: JwtPayload) {
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      lastName: payload.lastName,
      phone: payload.phone,
      roleId: payload.roleId,
      role: payload.role,
    };
  }
}
