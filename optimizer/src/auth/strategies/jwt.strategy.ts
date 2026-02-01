import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AUTH_CONSTANTS } from '../constants/auth.constants';

/**
 * JWT payload structure
 */
export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

/**
 * Validated user from JWT
 */
export interface JwtUser {
  userId: string;
  email: string;
  role: string;
}

/**
 * JWT Access Token Strategy
 * Validates access tokens from Authorization header
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(
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

  /**
   * Validate JWT payload and return user data
   */
  public validate(payload: JwtPayload): JwtUser {
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
