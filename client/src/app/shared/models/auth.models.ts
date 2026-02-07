export interface LoginDto {
  readonly email: string;
  readonly password: string;
}

export interface RegisterDto {
  readonly companyName: string;
  readonly email: string;
  readonly password: string;
  readonly phone?: string;
}

export interface AuthUser {
  readonly id: string;
  readonly email: string;
  readonly companyName: string;
  readonly role: string;
}

export interface AuthResponse {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly user: AuthUser;
}

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
}
