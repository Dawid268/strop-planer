import { Test, TestingModule } from '@nestjs/testing';
import { AtStrategy } from './at.strategy';
import { ConfigService } from '@nestjs/config';

describe('AtStrategy', () => {
  let strategy: AtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AtStrategy,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
      ],
    }).compile();

    strategy = module.get<AtStrategy>(AtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return user data from JWT payload', () => {
      const payload = {
        sub: 'user-123',
        email: 'test@example.com',
        role: 'admin',
      };

      const result = strategy.validate(payload);

      expect(result).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'admin',
      });
    });
  });
});
