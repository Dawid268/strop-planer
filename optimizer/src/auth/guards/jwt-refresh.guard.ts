import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT Refresh Token Guard
 * Protects the token refresh endpoint
 */
@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}
