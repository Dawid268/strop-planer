import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { Router } from "@angular/router";
import { AuthService } from "./auth.service";
import { AuthResponse, LoginDto, RegisterDto } from "../models/auth.models";
import { environment } from "@env/environment";
import { ApiResponse } from "@core/models/api-response.model";

describe("AuthService (Black-box)", () => {
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
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe("login", () => {
    it("should send POST to /login and return response", (done) => {
      const dto: LoginDto = { email: "test@example.com", password: "password" };
      const mockResponse: ApiResponse<AuthResponse> = {
        data: {
          access_token: "at",
          refresh_token: "rt",
          user: {
            id: "1",
            email: "test@example.com",
            companyName: "C",
            role: "owner",
          },
        },
        status: "success",
        message: "",
        timestamp: new Date(),
      };

      service.login(dto).subscribe((res) => {
        expect(res).toEqual(mockResponse);
        done();
      });

      const req = httpMock.expectOne(`${API_URL}/login`);
      expect(req.request.method).toBe("POST");
      expect(req.request.body).toEqual(dto);
      req.flush(mockResponse);
    });

    it("should set isLoading signal during request", () => {
      const dto: LoginDto = { email: "t@t.pl", password: "p" };
      service.login(dto).subscribe();

      expect(service.isLoading()).toBe(true);

      const req = httpMock.expectOne(`${API_URL}/login`);
      req.flush({});
      expect(service.isLoading()).toBe(false);
    });
  });

  describe("register", () => {
    it("should send POST to /register", (done) => {
      const dto: RegisterDto = {
        email: "n@n.pl",
        password: "p",
        companyName: "C",
      };

      service.register(dto).subscribe((res) => {
        expect(res).toBeDefined();
        done();
      });

      const req = httpMock.expectOne(`${API_URL}/register`);
      expect(req.request.method).toBe("POST");
      expect(req.request.body).toEqual(dto);
      req.flush({ success: true });
    });
  });

  describe("logout", () => {
    it("should clear tokens and navigate to login", () => {
      localStorage.setItem("access_token", "at");
      localStorage.setItem("refresh_token", "rt");

      service.logout();

      const req = httpMock.expectOne(`${API_URL}/logout`);
      expect(req.request.method).toBe("POST");
      req.flush({});

      expect(localStorage.getItem("access_token")).toBeNull();
      expect(localStorage.getItem("refresh_token")).toBeNull();
      expect(router.navigate).toHaveBeenCalledWith(["/login"]);
    });
  });

  describe("isAuthenticated", () => {
    it("should return true if token exists", () => {
      localStorage.setItem("access_token", "at");
      expect(service.isAuthenticated()).toBe(true);
    });

    it("should return false if no token", () => {
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe("refreshToken", () => {
    it("should send POST to /refresh and save tokens", (done) => {
      localStorage.setItem("refresh_token", "old_rt");
      const mockResponse: ApiResponse<AuthResponse> = {
        data: {
          access_token: "new_at",
          refresh_token: "new_rt",
          user: {} as any,
        },
        status: "success",
        message: "",
        timestamp: new Date(),
      };

      service.refreshToken().subscribe((res) => {
        expect(localStorage.getItem("access_token")).toBe("new_at");
        expect(localStorage.getItem("refresh_token")).toBe("new_rt");
        done();
      });

      const req = httpMock.expectOne(`${API_URL}/refresh`);
      expect(req.request.headers.get("Authorization")).toBe("Bearer old_rt");
      req.flush(mockResponse);
    });
  });
});
