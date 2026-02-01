/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from '../services/auth.service';
import { UserDto, TokenResponseDto } from '../dto/auth.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockUser: UserDto = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    companyName: 'Test Company',
    role: 'admin',
    isActive: true,
  };

  const mockTokenResponse: TokenResponseDto = {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    user: mockUser,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
            logout: jest.fn(),
            refreshTokens: jest.fn(),
            register: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should return tokens on successful login', async () => {
      authService.login.mockResolvedValue(mockTokenResponse);

      const req = { user: mockUser } as never;
      const result = await controller.login(req);

      expect(result).toEqual(mockTokenResponse);
      expect(authService.login).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('logout', () => {
    it('should call logout service', async () => {
      authService.logout.mockResolvedValue(undefined);

      await controller.logout('user-123');

      expect(authService.logout).toHaveBeenCalledWith('user-123');
    });
  });

  describe('refreshTokens', () => {
    it('should return new tokens', async () => {
      authService.refreshTokens.mockResolvedValue(mockTokenResponse);

      const result = await controller.refreshTokens(
        'user-123',
        'refresh-token',
      );

      expect(result).toEqual(mockTokenResponse);
      expect(authService.refreshTokens).toHaveBeenCalledWith(
        'user-123',
        'refresh-token',
      );
    });
  });

  describe('register', () => {
    it('should create new user', async () => {
      authService.register.mockResolvedValue(mockUser);

      const dto = {
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
        companyName: 'New Company',
      };

      const result = await controller.register(dto);

      expect(result).toEqual(mockUser);
      expect(authService.register).toHaveBeenCalledWith(dto);
    });
  });

  describe('getProfile', () => {
    it('should return current user', () => {
      const result = controller.getProfile(mockUser);

      expect(result).toEqual(mockUser);
    });
  });
});
