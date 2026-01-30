import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../inventory/entities/user.entity';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AtStrategy } from './at.strategy';
import { ConfigService } from '@nestjs/config';
import { RtStrategy } from './rt.strategy';
import { LocalStrategy } from './local.strategy';
import { AtGuard, RtGuard, LocalAuthGuard } from './auth.guard';
import { AUTH_CONSTANTS } from './constants/auth.constants';

import { AuthProfile } from './profiles/auth.profile';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    PassportModule,
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>(AUTH_CONSTANTS.CONFIG.JWT_SECRET),
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    AuthService,
    LocalStrategy,
    AtStrategy,
    RtStrategy,
    AuthProfile,
    AtGuard,
    RtGuard,
    LocalAuthGuard,
  ],
  controllers: [AuthController],
  exports: [AuthService, AtGuard, RtGuard, LocalAuthGuard],
})
export class AuthModule {}
