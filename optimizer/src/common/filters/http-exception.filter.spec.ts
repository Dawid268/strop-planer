/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { HttpExceptionFilter } from './http-exception.filter';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AppError } from '@shared/errors/app-error';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockRequest: { headers: Record<string, string>; url: string; method: string };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockRequest = {
      headers: { 'x-correlation-id': 'test-correlation-id' },
      url: '/test',
      method: 'GET',
    };
    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  it('should handle AppError correctly', () => {
    const appError = new AppError(
      'TEST_ERROR',
      'Test message',
      400,
      'User message',
    );

    filter.catch(appError, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(400);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'TEST_ERROR',
          message: 'User message',
        }),
      }),
    );
  });

  it('should handle HttpException correctly', () => {
    const httpException = new HttpException('Not Found', HttpStatus.NOT_FOUND);

    filter.catch(httpException, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(404);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'NOT_FOUND',
          correlationId: 'test-correlation-id',
        }),
      }),
    );
  });

  it('should handle generic Error correctly', () => {
    const error = new Error('Something went wrong');

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INTERNAL_SERVER_ERROR',
        }),
      }),
    );
  });

  it('should handle unknown exception type', () => {
    filter.catch('string error', mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
          correlationId: 'test-correlation-id',
        }),
      }),
    );
  });

  it('should include timestamp and correlationId in response', () => {
    const error = new Error('Test');

    filter.catch(error, mockHost);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          timestamp: expect.any(String),
          correlationId: 'test-correlation-id',
        }),
      }),
    );
  });
});
