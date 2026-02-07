import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { AuthResponse, LoginDto, RegisterDto } from '@models/auth.models';
import { environment } from '@env/environment';
import { ApiResponse } from '@models/api-response.model';

describe('AuthService (Black-box)', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let router: jest.Mocked<Router>;
  const API_URL = `${environment.apiUrl}/auth`;

  beforeEach(() => {
    const routerMock = {
      navigate: jest.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: Router, useValue: routerMock },
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router) as jest.Mocked<Router>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('login', () => {
    it('should send POST to /login and return response data', (done) => {
      const dto: LoginDto = { email: 'test@example.com', password: 'password' };
      const authData: AuthResponse = {
        access_token: 'at',
        refresh_token: 'rt',
        user: {
          id: '1',
          email: 'test@example.com',
          companyName: 'C',
          role: 'owner',
        },
      };
      const mockResponse: ApiResponse<AuthResponse> = {
        success: true,
        data: authData,
        timestamp: new Date().toISOString(),
        correlationId: 'cid',
      };

      service.login(dto).subscribe((res) => {
        expect(res).toEqual(authData);
        done();
      });

      const req = httpMock.expectOne(`${API_URL}/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush(mockResponse);
    });
  });

  describe('register', () => {
    it('should send POST to /register', (done) => {
      const dto: RegisterDto = {
        email: 'n@n.pl',
        password: 'p',
        companyName: 'C',
      };

      service.register(dto).subscribe((res) => {
        expect(res).toBeUndefined();
        done();
      });

      const req = httpMock.expectOne(`${API_URL}/register`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush({ success: true, data: {}, timestamp: '', correlationId: '' });
    });
  });

  describe('logout', () => {
    it('should call POST /logout when token present and navigate to login', () => {
      service.logout('at');

      const req = httpMock.expectOne(`${API_URL}/logout`);
      expect(req.request.method).toBe('POST');
      req.flush({});
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('should not call POST /logout when token is null', () => {
      service.logout(null);
      expect(router.navigate).toHaveBeenCalledWith(['/login']);
      httpMock.expectNone(`${API_URL}/logout`);
    });
  });

  describe('refreshToken', () => {
    it('should send POST to /refresh with Bearer token and return new tokens', (done) => {
      const mockResponse: ApiResponse<AuthResponse> = {
        success: true,
        data: {
          access_token: 'new_at',
          refresh_token: 'new_rt',
          user: {
            id: '1',
            email: 'u@u.pl',
            companyName: 'C',
            role: 'user',
          },
        },
        timestamp: new Date().toISOString(),
        correlationId: 'cid',
      };

      service.refreshToken('old_rt').subscribe((res) => {
        expect(res.access_token).toBe('new_at');
        expect(res.refresh_token).toBe('new_rt');
        done();
      });

      const req = httpMock.expectOne(`${API_URL}/refresh`);
      expect(req.request.headers.get('Authorization')).toBe('Bearer old_rt');
      req.flush(mockResponse);
    });
  });
});
