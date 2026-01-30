import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AUTH_CONSTANTS } from './constants/auth.constants';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class RtStrategy extends PassportStrategy(
  Strategy,
  AUTH_CONSTANTS.STRATEGIES.JWT_REFRESH,
) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey:
        config.get<string>(AUTH_CONSTANTS.CONFIG.JWT_SECRET) || 'secret',
      passReqToCallback: true,
    });
  }

  public validate(
    req: Request,
    payload: JwtPayload,
  ): JwtPayload & { refreshToken: string } {
    const refreshToken = req.get('authorization')?.replace('Bearer', '').trim();

    if (!refreshToken) {
      throw new ForbiddenException('Refresh token malformed');
    }

    return {
      ...payload,
      refreshToken,
    };
  }
}
