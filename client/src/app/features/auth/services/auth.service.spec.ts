import { TestBed, fakeAsync, tick } from "@angular/core/testing";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { provideHttpClient } from "@angular/common/http";
import { provideZonelessChangeDetection } from "@angular/core";
import { Router } from "@angular/router";
import {
  AuthService,
  LoginDto,
  RegisterDto,
  AuthResponse,
} from "./auth.service";
import { AppStore } from "../../../core/store/app.store";
import { environment } from "../../../../environments/environment";

describe("AuthService", () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;
  const API_URL = `${environment.apiUrl}/auth`;

  const mockUser = {
    id: "user-1",
    email: "test@example.com",
    companyName: "Test Company",
    role: "owner",
  };

  const mockAuthResponse: AuthResponse = {
    access_token: "mock-jwt-token",
    user: mockUser,
  };

  beforeEach(() => {
    routerSpy = jasmine.createSpyObj("Router", ["navigate"]);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy },
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);

    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe("login", () => {
    it("should be defined", () => {
      expect(service.login).toBeDefined();
    });

    it("should send POST to /auth/login with credentials", () => {
      const loginDto: LoginDto = {
        email: "test@example.com",
        password: "password123",
      };

      service.login(loginDto).subscribe((response) => {
        expect(response.access_token).toBe("mock-jwt-token");
      });

      const req = httpMock.expectOne(`${API_URL}/login`);
      expect(req.request.method).toBe("POST");
      expect(req.request.body).toEqual(loginDto);
      req.flush(mockAuthResponse);
    });

    it("should set isLoading to true during request", () => {
      const loginDto: LoginDto = {
        email: "test@example.com",
        password: "password123",
      };

      expect(service.isLoading()).toBeFalse();
      service.login(loginDto).subscribe();
      expect(service.isLoading()).toBeTrue();

      const req = httpMock.expectOne(`${API_URL}/login`);
      req.flush(mockAuthResponse);
    });

    it("should navigate to /editor after successful login", fakeAsync(() => {
      const loginDto: LoginDto = {
        email: "test@example.com",
        password: "password123",
      };

      service.login(loginDto).subscribe();

      const req = httpMock.expectOne(`${API_URL}/login`);
      req.flush(mockAuthResponse);
      tick();

      expect(routerSpy.navigate).toHaveBeenCalledWith(["/editor"]);
    }));

    it("should save token to localStorage", fakeAsync(() => {
      const loginDto: LoginDto = {
        email: "test@example.com",
        password: "password123",
      };

      service.login(loginDto).subscribe();

      const req = httpMock.expectOne(`${API_URL}/login`);
      req.flush(mockAuthResponse);
      tick();

      expect(localStorage.getItem("access_token")).toBe("mock-jwt-token");
    }));

    it("should set error on failure", fakeAsync(() => {
      const loginDto: LoginDto = {
        email: "test@example.com",
        password: "wrong",
      };

      service.login(loginDto).subscribe({
        error: () => {
          expect(service.error()).toBeDefined();
        },
      });

      const req = httpMock.expectOne(`${API_URL}/login`);
      req.flush(
        { message: "Invalid credentials" },
        { status: 401, statusText: "Unauthorized" }
      );
      tick();
    }));
  });

  describe("register", () => {
    it("should be defined", () => {
      expect(service.register).toBeDefined();
    });

    it("should send POST to /auth/register with registration data", () => {
      const registerDto: RegisterDto = {
        companyName: "New Company",
        email: "new@example.com",
        password: "password123",
        phone: "+48123456789",
      };

      service.register(registerDto).subscribe();

      const req = httpMock.expectOne(`${API_URL}/register`);
      expect(req.request.method).toBe("POST");
      expect(req.request.body).toEqual(registerDto);
      req.flush({ message: "User created" });
    });

    it("should navigate to /login after successful registration", fakeAsync(() => {
      const registerDto: RegisterDto = {
        companyName: "New Company",
        email: "new@example.com",
        password: "password123",
      };

      service.register(registerDto).subscribe();

      const req = httpMock.expectOne(`${API_URL}/register`);
      req.flush({ message: "User created" });
      tick();

      expect(routerSpy.navigate).toHaveBeenCalledWith(["/login"]);
    }));
  });

  describe("logout", () => {
    it("should be defined", () => {
      expect(service.logout).toBeDefined();
    });

    it("should navigate to /login", () => {
      service.logout();
      expect(routerSpy.navigate).toHaveBeenCalledWith(["/login"]);
    });
  });

  describe("isAuthenticated", () => {
    it("should be defined", () => {
      expect(service.isAuthenticated).toBeDefined();
    });

    it("should return false when no token", () => {
      expect(service.isAuthenticated()).toBeFalse();
    });

    it("should return true when token exists", () => {
      localStorage.setItem("access_token", "some-token");
      expect(service.isAuthenticated()).toBeTrue();
    });
  });

  describe("getToken", () => {
    it("should be defined", () => {
      expect(service.getToken).toBeDefined();
    });

    it("should return null when no token", () => {
      expect(service.getToken()).toBeNull();
    });

    it("should return token from localStorage", () => {
      localStorage.setItem("access_token", "stored-token");
      expect(service.getToken()).toBe("stored-token");
    });
  });

  describe("error signal", () => {
    it("should be null initially", () => {
      expect(service.error()).toBeNull();
    });
  });

  describe("isLoading signal", () => {
    it("should be false initially", () => {
      expect(service.isLoading()).toBeFalse();
    });
  });
});
