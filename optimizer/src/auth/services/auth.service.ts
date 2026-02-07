import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Mapper } from '@automapper/core';
import { InjectMapper } from '@automapper/nestjs';
import { ConfigService } from '@nestjs/config';

import { UserEntity } from '@/inventory/entities/user.entity';
import { RegisterDto, UserDto, TokenResponseDto } from '@/auth/dto/auth.dto';
import { UnauthorizedError, ValidationError } from '@shared/errors/app-error';
import { AUTH_CONSTANTS } from '@/auth/constants/auth.constants';

/**
 * Authentication Service
 * Handles user authentication, token generation, and registration
 */
@Injectable()
export class AuthService {
  public constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectMapper() private readonly mapper: Mapper,
  ) {}

  /**
   * Validate user credentials
   */
  public async validateUser(
    email: string,
    password: string,
  ): Promise<UserDto | null> {
    const user = await this.userRepository.findOne({ where: { email } });

    if (!user || !user.isActive) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    return this.mapper.mapAsync(user, UserEntity, UserDto);
  }

  /**
   * Login user and return tokens
   */
  public async login(user: UserDto): Promise<TokenResponseDto> {
    const userEntity = await this.userRepository.findOne({
      where: { id: user.id },
    });

    if (!userEntity) {
      throw new UnauthorizedError('User not found');
    }

    const tokens = await this.generateTokens(userEntity);
    await this.updateRefreshTokenHash(userEntity.id, tokens.refresh_token);

    return tokens;
  }

  /**
   * Logout user by clearing refresh token
   */
  public async logout(userId: string): Promise<void> {
    await this.userRepository.update(userId, { hashedRt: null });
  }

  /**
   * Refresh access token using refresh token
   */
  public async refreshTokens(
    userId: string,
    refreshToken: string,
  ): Promise<TokenResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user || !user.hashedRt) {
      throw new UnauthorizedError('Access Denied: Invalid session');
    }

    const isRefreshTokenValid = await bcrypt.compare(
      refreshToken,
      user.hashedRt,
    );
    if (!isRefreshTokenValid) {
      throw new UnauthorizedError('Access Denied: Invalid refresh token');
    }

    const tokens = await this.generateTokens(user);
    await this.updateRefreshTokenHash(user.id, tokens.refresh_token);

    return tokens;
  }

  /**
   * Register a new user
   */
  public async register(dto: RegisterDto): Promise<UserDto> {
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ValidationError('Email already registered', {
        email: 'Użytkownik o takim emailu już istnieje',
      });
    }

    const passwordHash = await this.hashPassword(dto.password);

    const newUser = this.userRepository.create({
      ...dto,
      passwordHash,
      role: AUTH_CONSTANTS.ROLES.ADMIN,
      isActive: true,
    });

    const savedUser = await this.userRepository.save(newUser);
    return this.mapper.mapAsync(savedUser, UserEntity, UserDto);
  }

  /**
   * Hash password with bcrypt
   */
  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(
      AUTH_CONSTANTS.DEFAULTS.BCRYPT_SALT_ROUNDS,
    );
    return bcrypt.hash(password, salt);
  }

  /**
   * Update refresh token hash in database
   */
  private async updateRefreshTokenHash(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const hash = await bcrypt.hash(
      refreshToken,
      AUTH_CONSTANTS.DEFAULTS.BCRYPT_SALT_ROUNDS,
    );
    await this.userRepository.update(userId, { hashedRt: hash });
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(user: UserEntity): Promise<TokenResponseDto> {
    const secret =
      this.config.get<string>(AUTH_CONSTANTS.CONFIG.JWT_SECRET) ||
      AUTH_CONSTANTS.DEFAULTS.JWT_SECRET;

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret,
        expiresIn: AUTH_CONSTANTS.DEFAULTS.ACCESS_TOKEN_EXPIRY,
      }),
      this.jwtService.signAsync(payload, {
        secret,
        expiresIn: AUTH_CONSTANTS.DEFAULTS.REFRESH_TOKEN_EXPIRY,
      }),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: this.mapper.map(user, UserEntity, UserDto),
    };
  }
}
