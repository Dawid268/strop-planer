/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { HttpExceptionFilter } from './http-exception.filter';
import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AppError } from '@shared/errors/app-error';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: { status: jest.Mock; json: jest.Mock };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => ({}),
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
          code: 'HTTP_EXCEPTION',
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
          message: 'Something went wrong',
        }),
      }),
    );
  });

  it('should include timestamp in response', () => {
    const error = new Error('Test');

    filter.catch(error, mockHost);

    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          timestamp: expect.any(String),
        }),
      }),
    );
  });
});
