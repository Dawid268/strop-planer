import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getMapperToken } from '@automapper/nestjs';
import { UserEntity } from '../inventory/entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import { createMapper, createMap, forMember, mapFrom } from '@automapper/core';
import { classes } from '@automapper/classes';
import { ConfigService } from '@nestjs/config';
import { UserDto } from './dto/auth.dto';
import * as bcrypt from 'bcrypt';

// Mock bcrypt correctly
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
  genSalt: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: JwtService;

  const mockUserEntity = {
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: '$2b$10$hashedpassword',
    companyName: 'Test Corp',
    role: 'admin',
    isActive: true,
  };

  const mockUserRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockImplementation(
      (dto: Partial<UserEntity>): Partial<UserEntity> => ({
        ...dto,
        id: 'new-user-id',
        isActive: true,
      }),
    ),
  };

  const mockJwtService = {
    signAsync: jest.fn().mockResolvedValue('mock_token'),
  };

  const mockMapper = createMapper({ strategyInitializer: classes() });
  createMap(
    mockMapper,
    UserEntity,
    UserDto,
    forMember(
      (d) => d.email,
      mapFrom((s) => s.email),
    ),
  );

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockUserRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('secret') },
        },
        {
          provide: getMapperToken(),
          useValue: mockMapper,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user without password if validation is successful', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUserEntity);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(
        'test@example.com',
        'password123',
      );

      expect(result).toBeDefined();
      expect(result).not.toHaveProperty('passwordHash');
      expect(result?.email).toBe('test@example.com');
      expect(bcrypt.compare).toHaveBeenCalledWith(
        'password123',
        mockUserEntity.passwordHash,
      );
    });

    it('should return null if password is incorrect', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUserEntity);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser(
        'test@example.com',
        'wrongpassword',
      );

      expect(result).toBeNull();
    });

    it('should return null if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.validateUser(
        'unknown@example.com',
        'password123',
      );

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return access token', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUserEntity);
      const result = await service.login({
        email: 'test@example.com',
        id: 'user-123',
        companyName: 'Test Corp',
        role: 'admin',
        isActive: true,
        hashPassword: jest.fn(),
      });

      expect(result).toHaveProperty('access_token');
      expect(result.access_token).toBe('mock_token');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(jwtService.signAsync).toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('should hash password and save user', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.save.mockResolvedValue(mockUserEntity);
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$hashedpassword');

      const dto = {
        email: 'test@example.com',
        password: 'password123',
        companyName: 'Test Corp',
      };

      const result = await service.register(dto);

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 'salt');
      expect(mockUserRepository.create).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw ValidationError if email already exists', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUserEntity);

      const dto = {
        email: 'test@example.com',
        password: 'password123',
        companyName: 'Test Corp',
      };

      await expect(service.register(dto)).rejects.toThrow(
        'Użytkownik o takim emailu już istnieje',
      );
    });
  });

  describe('logout', () => {
    it('should clear refresh token hash', async () => {
      mockUserRepository.update.mockResolvedValue({ affected: 1 });

      await service.logout('user-123');

      expect(mockUserRepository.update).toHaveBeenCalledWith('user-123', {
        hashedRt: null,
      });
    });
  });

  describe('refreshTokens', () => {
    it('should return new tokens if refresh token is valid', async () => {
      const userWithRt = {
        ...mockUserEntity,
        hashedRt: '$2b$10$hashedRefreshToken',
      };
      mockUserRepository.findOne.mockResolvedValue(userWithRt);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$newHashedRt');

      const result = await service.refreshTokens(
        'user-123',
        'validRefreshToken',
      );

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(mockUserRepository.update).toHaveBeenCalled();
    });

    it('should throw UnauthorizedError if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.refreshTokens('non-existent', 'token'),
      ).rejects.toThrow('Access Denied: User not found or no RT');
    });

    it('should throw UnauthorizedError if user has no refresh token', async () => {
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUserEntity,
        hashedRt: null,
      });

      await expect(service.refreshTokens('user-123', 'token')).rejects.toThrow(
        'Access Denied: User not found or no RT',
      );
    });

    it('should throw UnauthorizedError if refresh token is invalid', async () => {
      const userWithRt = {
        ...mockUserEntity,
        hashedRt: '$2b$10$hashedRefreshToken',
      };
      mockUserRepository.findOne.mockResolvedValue(userWithRt);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.refreshTokens('user-123', 'invalidToken'),
      ).rejects.toThrow('Access Denied: Invalid RT');
    });
  });

  describe('login edge cases', () => {
    it('should throw UnauthorizedError if user not found during login', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'test@example.com',
          id: 'non-existent',
          companyName: 'Test Corp',
          role: 'admin',
          isActive: true,
          hashPassword: jest.fn(),
        }),
      ).rejects.toThrow('User not found');
    });
  });

  describe('validateUser edge cases', () => {
    it('should return null if user is not active', async () => {
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUserEntity,
        isActive: false,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(
        'test@example.com',
        'password123',
      );

      expect(result).toBeNull();
    });
  });
});
