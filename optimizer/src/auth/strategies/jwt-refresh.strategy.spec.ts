import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { JwtRefreshStrategy } from './jwt-refresh.strategy';
import { JwtPayload } from './jwt.strategy';

describe('JwtRefreshStrategy', () => {
  let strategy: JwtRefreshStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtRefreshStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtRefreshStrategy>(JwtRefreshStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return user with refresh token', () => {
      const mockRequest = {
        get: jest.fn().mockReturnValue('Bearer test-refresh-token'),
      } as unknown as Request;

      const payload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'admin',
      };

      const result = strategy.validate(mockRequest, payload);

      expect(result).toEqual({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'admin',
        refreshToken: 'test-refresh-token',
      });
    });

    it('should throw ForbiddenException when refresh token is missing', () => {
      const mockRequest = {
        get: jest.fn().mockReturnValue(undefined),
      } as unknown as Request;

      const payload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'admin',
      };

      expect(() => strategy.validate(mockRequest, payload)).toThrow(
        ForbiddenException,
      );
    });
  });
});
