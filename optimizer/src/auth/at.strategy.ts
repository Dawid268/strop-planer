import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AUTH_CONSTANTS } from './constants/auth.constants';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class AtStrategy extends PassportStrategy(
  Strategy,
  AUTH_CONSTANTS.STRATEGIES.JWT,
) {
  public constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        config.get<string>(AUTH_CONSTANTS.CONFIG.JWT_SECRET) ||
        AUTH_CONSTANTS.DEFAULTS.JWT_SECRET,
    });
  }

  public validate(payload: JwtPayload): {
    userId: string;
    email: string;
    role: string;
  } {
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
