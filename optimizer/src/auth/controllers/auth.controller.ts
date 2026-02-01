import {
  Controller,
  Request,
  Post,
  UseGuards,
  Body,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';

import { AuthService } from '../services/auth.service';
import { LocalGuard, JwtGuard, JwtRefreshGuard } from '../guards';
import {
  LoginDto,
  RegisterDto,
  TokenResponseDto,
  UserDto,
} from '../dto/auth.dto';
import { GetCurrentUserId, GetCurrentUser, Public } from '@common/decorators';

/**
 * Request with authenticated user
 */
interface AuthenticatedRequest extends ExpressRequest {
  user: UserDto;
}

/**
 * Authentication Controller
 * Handles login, logout, registration, and token refresh
 */
@ApiTags('Auth')
@Controller({ version: '1', path: 'auth' })
export class AuthController {
  public constructor(private readonly authService: AuthService) {}

  /**
   * Login with email and password
   */
  @UseGuards(LocalGuard)
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Zaloguj się (email/hasło)' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, type: TokenResponseDto })
  @ApiResponse({ status: 429, description: 'Too many login attempts' })
  public async login(
    @Request() req: AuthenticatedRequest,
  ): Promise<TokenResponseDto> {
    return this.authService.login(req.user);
  }

  /**
   * Logout current user
   */
  @Post('logout')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Wyloguj użytkownika' })
  @ApiResponse({ status: 200, description: 'Successfully logged out' })
  public async logout(@GetCurrentUserId() userId: string): Promise<void> {
    return this.authService.logout(userId);
  }

  /**
   * Refresh access token using refresh token
   */
  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Odśwież tokeny' })
  @ApiResponse({ status: 200, type: TokenResponseDto })
  public async refreshTokens(
    @GetCurrentUserId() userId: string,
    @GetCurrentUser('refreshToken') refreshToken: string,
  ): Promise<TokenResponseDto> {
    return this.authService.refreshTokens(userId, refreshToken);
  }

  /**
   * Register new user account
   */
  @Public()
  @Post('register')
  @Throttle({ short: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: 'Zarejestruj nowe konto' })
  @ApiResponse({ status: 201, type: UserDto })
  @ApiResponse({ status: 429, description: 'Too many registration attempts' })
  public async register(@Body() dto: RegisterDto): Promise<UserDto> {
    return this.authService.register(dto);
  }

  /**
   * Get current user profile
   */
  @UseGuards(JwtGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pobierz profil zalogowanego użytkownika' })
  @ApiResponse({ status: 200, type: UserDto })
  public getProfile(@GetCurrentUser() user: UserDto): UserDto {
    return user;
  }
}
