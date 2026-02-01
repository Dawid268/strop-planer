import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { UserEntity } from '../inventory/entities/user.entity';
import { AUTH_CONSTANTS } from './constants/auth.constants';

// Services
import { AuthService } from './services/auth.service';

// Controllers
import { AuthController } from './controllers/auth.controller';

// Strategies
import { JwtStrategy, JwtRefreshStrategy, LocalStrategy } from './strategies';

// Guards
import { JwtGuard, JwtRefreshGuard, LocalGuard } from './guards';

// Profiles
import { AuthProfile } from './profiles/auth.profile';

/**
 * Authentication Module
 * Provides JWT-based authentication with access and refresh tokens
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>(AUTH_CONSTANTS.CONFIG.JWT_SECRET),
        signOptions: {
          expiresIn: AUTH_CONSTANTS.DEFAULTS.ACCESS_TOKEN_EXPIRY,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    // Services
    AuthService,

    // Strategies
    JwtStrategy,
    JwtRefreshStrategy,
    LocalStrategy,

    // Guards
    JwtGuard,
    JwtRefreshGuard,
    LocalGuard,

    // Profiles
    AuthProfile,
  ],
  exports: [AuthService, JwtGuard, JwtRefreshGuard, LocalGuard],
})
export class AuthModule {}
