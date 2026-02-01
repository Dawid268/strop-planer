/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { TransformInterceptor } from './transform.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
    mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: { 'x-correlation-id': 'test-correlation-id' },
        }),
      }),
    } as unknown as ExecutionContext;
  });

  it('should wrap response in standard format', async () => {
    const mockData = { id: 1, name: 'Test' };
    const mockCallHandler: CallHandler = {
      handle: () => of(mockData),
    };

    const result = await lastValueFrom(
      interceptor.intercept(mockContext, mockCallHandler),
    );

    expect(result).toEqual({
      success: true,
      data: mockData,
      timestamp: expect.any(String),
      correlationId: 'test-correlation-id',
    });
  });

  it('should handle array responses', async () => {
    const mockData = [{ id: 1 }, { id: 2 }];
    const mockCallHandler: CallHandler = {
      handle: () => of(mockData),
    };

    const result = await lastValueFrom(
      interceptor.intercept(mockContext, mockCallHandler),
    );

    expect(result.success).toBe(true);
    expect(result.data).toEqual(mockData);
    expect(result.correlationId).toBe('test-correlation-id');
  });

  it('should handle null response', async () => {
    const mockCallHandler: CallHandler = {
      handle: () => of(null),
    };

    const result = await lastValueFrom(
      interceptor.intercept(mockContext, mockCallHandler),
    );

    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
    expect(result.correlationId).toBe('test-correlation-id');
  });

  it('should include ISO timestamp and correlationId', async () => {
    const mockCallHandler: CallHandler = {
      handle: () => of({}),
    };

    const result = await lastValueFrom(
      interceptor.intercept(mockContext, mockCallHandler),
    );

    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(result.correlationId).toBe('test-correlation-id');
  });
});
