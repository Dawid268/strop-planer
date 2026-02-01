import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { UserDto } from '../dto/auth.dto';

/**
 * Local Strategy
 * Validates username (email) and password for login
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  public constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email' });
  }

  /**
   * Validate user credentials
   */
  public async validate(email: string, password: string): Promise<UserDto> {
    const user = await this.authService.validateUser(email, password);

    if (!user) {
      throw new UnauthorizedException('Nieprawidłowy email lub hasło');
    }

    return user;
  }
}
