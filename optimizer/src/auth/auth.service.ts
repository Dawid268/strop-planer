import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity } from '../inventory/entities/user.entity';
import { RegisterDto, UserDto, TokenResponseDto } from './dto/auth.dto';
import { Mapper } from '@automapper/core';
import { InjectMapper } from '@automapper/nestjs';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedError, ValidationError } from '@shared/errors/app-error';
import { AUTH_CONSTANTS } from './constants/auth.constants';

@Injectable()
export class AuthService {
  public constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectMapper() private readonly mapper: Mapper,
  ) {}

  public async validateUser(
    email: string,
    pass: string,
  ): Promise<UserDto | null> {
    const user = await this.userRepository.findOne({ where: { email } });
    if (
      user &&
      user.isActive &&
      (await bcrypt.compare(pass, user.passwordHash))
    ) {
      return this.mapper.mapAsync(user, UserEntity, UserDto);
    }
    return null;
  }

  public async login(user: UserDto): Promise<TokenResponseDto> {
    const userEntity = await this.userRepository.findOne({
      where: { id: user.id },
    });
    if (!userEntity) throw new UnauthorizedError('User not found');

    const tokens = await this.getTokens(userEntity);
    await this.updateRtHash(userEntity.id, tokens.refresh_token);

    return tokens;
  }

  public async logout(userId: string): Promise<void> {
    await this.userRepository.update(userId, { hashedRt: null });
  }

  public async refreshTokens(
    userId: string,
    rt: string,
  ): Promise<TokenResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.hashedRt) {
      throw new UnauthorizedError('Access Denied: User not found or no RT');
    }

    const rtMatches = await bcrypt.compare(rt, user.hashedRt);
    if (!rtMatches) {
      throw new UnauthorizedError('Access Denied: Invalid RT');
    }

    const tokens = await this.getTokens(user);
    await this.updateRtHash(user.id, tokens.refresh_token);

    return tokens;
  }

  private async updateRtHash(userId: string, rt: string): Promise<void> {
    const hash = await bcrypt.hash(rt, 10);
    await this.userRepository.update(userId, { hashedRt: hash });
  }

  private async getTokens(user: UserEntity): Promise<TokenResponseDto> {
    const secret =
      this.config.get<string>(AUTH_CONSTANTS.CONFIG.JWT_SECRET) ||
      AUTH_CONSTANTS.DEFAULTS.JWT_SECRET;
    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(
        { sub: user.id, email: user.email, role: user.role },
        { secret, expiresIn: AUTH_CONSTANTS.DEFAULTS.ACCESS_TOKEN_EXPIRY },
      ),
      this.jwtService.signAsync(
        { sub: user.id, email: user.email, role: user.role },
        { secret, expiresIn: AUTH_CONSTANTS.DEFAULTS.REFRESH_TOKEN_EXPIRY },
      ),
    ]);

    return {
      access_token: at,
      refresh_token: rt,
      user: this.mapper.map(user, UserEntity, UserDto),
    };
  }

  public async register(dto: RegisterDto): Promise<UserDto> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ValidationError('Użytkownik o takim emailu już istnieje', {
        email: 'Email already exists',
      });
    }

    const salt = await bcrypt.genSalt();
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const newUser = this.userRepository.create({
      ...dto,
      passwordHash,
      role: AUTH_CONSTANTS.ROLES.ADMIN,
      isActive: true,
    });

    const savedUser = await this.userRepository.save(newUser);
    return this.mapper.mapAsync(savedUser, UserEntity, UserDto);
  }
}
