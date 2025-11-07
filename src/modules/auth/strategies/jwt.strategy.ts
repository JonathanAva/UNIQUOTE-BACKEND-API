import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type JwtPayload = {
  sub: number;
  email: string;
  name: string;
  lastName: string;
  phone: string;
  roleId: number;
  role: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => req?.cookies?.access_token, // opcional si guardas el token en cookie
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.secret'),
    });
  }

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
