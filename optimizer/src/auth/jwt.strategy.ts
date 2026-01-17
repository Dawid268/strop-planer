import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';

// TODO: Move to environment variables in production
export const jwtConstants = {
  secret: 'SUPER_SECRET_KEY_FOR_MVP_ONLY_CHANGE_IN_PROD',
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  public constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConstants.secret,
    });
  }

  public async validate(payload: any) {
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
