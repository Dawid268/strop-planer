import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApiService } from './api';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('get', () => {
    it('should make GET request to correct URL', () => {
      const testData = { message: 'test' };

      service.get<{ message: string }>('/test').subscribe((data) => {
        expect(data).toEqual(testData);
      });

      const req = httpMock.expectOne('http://localhost:3000/test');
      expect(req.request.method).toBe('GET');
      req.flush(testData);
    });
  });

  describe('post', () => {
    it('should make POST request with body', () => {
      const requestBody = { name: 'Test' };
      const responseData = { id: '1', name: 'Test' };

      service
        .post<{ id: string; name: string }>('/items', requestBody)
        .subscribe((data) => {
          expect(data).toEqual(responseData);
        });

      const req = httpMock.expectOne('http://localhost:3000/items');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(requestBody);
      req.flush(responseData);
    });
  });

  describe('put', () => {
    it('should make PUT request with body', () => {
      const requestBody = { name: 'Updated' };
      const responseData = { id: '1', name: 'Updated' };

      service
        .put<{ id: string; name: string }>('/items/1', requestBody)
        .subscribe((data) => {
          expect(data).toEqual(responseData);
        });

      const req = httpMock.expectOne('http://localhost:3000/items/1');
      expect(req.request.method).toBe('PUT');
      req.flush(responseData);
    });
  });

  describe('delete', () => {
    it('should make DELETE request', () => {
      const responseData = { message: 'Deleted' };

      service.delete<{ message: string }>('/items/1').subscribe((data) => {
        expect(data).toEqual(responseData);
      });

      const req = httpMock.expectOne('http://localhost:3000/items/1');
      expect(req.request.method).toBe('DELETE');
      req.flush(responseData);
    });
  });

  describe('uploadFile', () => {
    it('should make POST request with FormData', () => {
      const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
      const responseData = { sourceFile: 'test.pdf' };

      service
        .uploadFile<{ sourceFile: string }>('/pdf/upload', file)
        .subscribe((data) => {
          expect(data).toEqual(responseData);
        });

      const req = httpMock.expectOne('http://localhost:3000/pdf/upload');
      expect(req.request.method).toBe('POST');
      expect(req.request.body instanceof FormData).toBe(true);
      req.flush(responseData);
    });
  });
});
