import { AtGuard, RtGuard, LocalAuthGuard } from './auth.guard';

describe('Auth Guards', () => {
  describe('AtGuard', () => {
    it('should be defined', () => {
      const guard = new AtGuard();
      expect(guard).toBeDefined();
    });
  });

  describe('RtGuard', () => {
    it('should be defined', () => {
      const guard = new RtGuard();
      expect(guard).toBeDefined();
    });
  });

  describe('LocalAuthGuard', () => {
    it('should be defined', () => {
      const guard = new LocalAuthGuard();
      expect(guard).toBeDefined();
    });
  });
});
