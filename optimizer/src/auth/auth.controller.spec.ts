/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserDto, TokenResponseDto, RegisterDto } from './dto/auth.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockUserDto: UserDto = {
    id: 'user-123',
    email: 'test@example.com',
    companyName: 'Test Corp',
    role: 'admin',
    isActive: true,
  };

  const mockTokenResponse: TokenResponseDto = {
    access_token: 'mock_access_token',
    refresh_token: 'mock_refresh_token',
    user: mockUserDto,
  };

  const mockAuthService = {
    login: jest.fn().mockResolvedValue(mockTokenResponse),
    logout: jest.fn().mockResolvedValue(undefined),
    refreshTokens: jest.fn().mockResolvedValue(mockTokenResponse),
    register: jest.fn().mockResolvedValue(mockUserDto),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should return token response on successful login', async () => {
      const mockRequest = { user: mockUserDto } as { user: UserDto };

      const result = await controller.login(mockRequest as never);

      expect(authService.login).toHaveBeenCalledWith(mockUserDto);
      expect(result).toEqual(mockTokenResponse);
    });
  });

  describe('logout', () => {
    it('should call authService.logout with user id', async () => {
      await controller.logout('user-123');

      expect(authService.logout).toHaveBeenCalledWith('user-123');
    });
  });

  describe('refreshTokens', () => {
    it('should return new tokens', async () => {
      const result = await controller.refreshTokens(
        'user-123',
        'refresh_token',
      );

      expect(authService.refreshTokens).toHaveBeenCalledWith(
        'user-123',
        'refresh_token',
      );
      expect(result).toEqual(mockTokenResponse);
    });
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const dto: RegisterDto = {
        email: 'new@example.com',
        password: 'password123',
        companyName: 'New Corp',
      };

      const result = await controller.register(dto);

      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockUserDto);
    });
  });

  describe('getProfile', () => {
    it('should return current user profile', () => {
      const result = controller.getProfile(mockUserDto);

      expect(result).toEqual(mockUserDto);
    });
  });
});
