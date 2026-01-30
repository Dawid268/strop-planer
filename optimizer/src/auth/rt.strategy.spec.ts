import { Test, TestingModule } from '@nestjs/testing';
import { RtStrategy } from './rt.strategy';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { Request } from 'express';

describe('RtStrategy', () => {
  let strategy: RtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
      ],
    }).compile();

    strategy = module.get<RtStrategy>(RtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return user data with refresh token', () => {
      const mockRequest = {
        get: jest.fn().mockReturnValue('Bearer valid-refresh-token'),
      } as unknown as Request;

      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'admin',
      };

      const result = strategy.validate(mockRequest, payload);

      expect(result).toEqual({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'admin',
        refreshToken: 'valid-refresh-token',
      });
    });

    it('should throw ForbiddenException if no refresh token', () => {
      const mockRequest = {
        get: jest.fn().mockReturnValue(undefined),
      } as unknown as Request;

      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'admin',
      };

      expect(() => strategy.validate(mockRequest, payload)).toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if empty authorization header', () => {
      const mockRequest = {
        get: jest.fn().mockReturnValue(''),
      } as unknown as Request;

      const payload = {
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
