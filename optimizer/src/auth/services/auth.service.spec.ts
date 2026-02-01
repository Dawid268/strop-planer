/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { getMapperToken } from '@automapper/nestjs';

import { AuthService } from './auth.service';
import { UserEntity } from '../../inventory/entities/user.entity';
import { UserDto } from '../dto/auth.dto';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<Repository<UserEntity>>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser: UserEntity = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    passwordHash: 'hashed-password',
    companyName: 'Test Company',
    role: 'admin',
    isActive: true,
    hashedRt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserDto: UserDto = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    companyName: 'Test Company',
    role: 'admin',
    isActive: true,
  };

  const mockMapper = {
    map: jest.fn().mockReturnValue(mockUserDto),
    mapAsync: jest.fn().mockResolvedValue(mockUserDto),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
        {
          provide: getMapperToken(),
          useValue: mockMapper,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryToken(UserEntity));
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should return user when credentials are valid', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser(
        'test@example.com',
        'password123',
      );

      expect(result).toEqual(mockUserDto);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.validateUser(
        'test@example.com',
        'password123',
      );

      expect(result).toBeNull();
    });

    it('should return null when password is invalid', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser(
        'test@example.com',
        'wrong-password',
      );

      expect(result).toBeNull();
    });

    it('should return null when user is not active', async () => {
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      const result = await service.validateUser(
        'test@example.com',
        'password123',
      );

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return tokens when login is successful', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      jwtService.signAsync.mockResolvedValueOnce('access-token');
      jwtService.signAsync.mockResolvedValueOnce('refresh-token');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-rt');

      const result = await service.login(mockUserDto);

      expect(result).toHaveProperty('access_token', 'access-token');
      expect(result).toHaveProperty('refresh_token', 'refresh-token');
      expect(result).toHaveProperty('user');
    });
  });

  describe('logout', () => {
    it('should clear refresh token hash', async () => {
      userRepository.update.mockResolvedValue({ affected: 1 } as never);

      await service.logout('user-123');

      expect(userRepository.update).toHaveBeenCalledWith('user-123', {
        hashedRt: null,
      });
    });
  });

  describe('register', () => {
    it('should create new user when email is not taken', async () => {
      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockReturnValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);
      (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const dto = {
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
        companyName: 'New Company',
      };

      const result = await service.register(dto);

      expect(result).toEqual(mockUserDto);
      expect(userRepository.create).toHaveBeenCalled();
      expect(userRepository.save).toHaveBeenCalled();
    });

    it('should throw error when email is already taken', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const dto = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        companyName: 'Test Company',
      };

      await expect(service.register(dto)).rejects.toThrow();
    });
  });
});
