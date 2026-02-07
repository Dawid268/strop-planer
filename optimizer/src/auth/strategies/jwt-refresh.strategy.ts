import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AUTH_CONSTANTS } from '@/auth/constants/auth.constants';
import { JwtPayload } from '@/auth/strategies/jwt.strategy';

/**
 * Refresh token user with token attached
 */
export interface RefreshTokenUser extends JwtPayload {
  refreshToken: string;
}

/**
 * JWT Refresh Token Strategy
 * Validates refresh tokens and extracts the token for verification
 */
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  AUTH_CONSTANTS.STRATEGIES.JWT_REFRESH,
) {
  public constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey:
        config.get<string>(AUTH_CONSTANTS.CONFIG.JWT_SECRET) ||
        AUTH_CONSTANTS.DEFAULTS.JWT_SECRET,
      passReqToCallback: true,
    });
  }

  /**
   * Validate refresh token and attach it to the user
   */
  public validate(req: Request, payload: JwtPayload): RefreshTokenUser {
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
