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
  @ApiOperation({
    summary: 'Zaloguj się',
    description:
      'Uwierzytelnia użytkownika za pomocą email i hasła. Zwraca access token (15 min) i refresh token (7 dni).',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Logowanie pomyślne',
    type: TokenResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Nieprawidłowy email lub hasło',
  })
  @ApiResponse({
    status: 429,
    description: 'Zbyt wiele prób logowania (max 5/min)',
  })
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
  @ApiOperation({
    summary: 'Wyloguj',
    description:
      'Unieważnia refresh token użytkownika. Wymaga ważnego access tokenu.',
  })
  @ApiResponse({
    status: 200,
    description: 'Wylogowano pomyślnie',
  })
  @ApiResponse({
    status: 401,
    description: 'Brak autoryzacji - wymagany token JWT',
  })
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
  @ApiOperation({
    summary: 'Odśwież tokeny',
    description:
      'Generuje nową parę tokenów (access + refresh) używając refresh tokenu. Stary refresh token zostaje unieważniony.',
  })
  @ApiResponse({
    status: 200,
    description: 'Tokeny odświeżone pomyślnie',
    type: TokenResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Nieprawidłowy lub wygasły refresh token',
  })
  @ApiResponse({
    status: 403,
    description: 'Refresh token niezgodny z zapisanym',
  })
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
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ short: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Rejestracja',
    description:
      'Tworzy nowe konto użytkownika. Email musi być unikalny. Hasło musi mieć min. 8 znaków.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'Konto utworzone pomyślnie',
    type: UserDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Błędne dane wejściowe (np. za krótkie hasło)',
  })
  @ApiResponse({
    status: 409,
    description: 'Email jest już zarejestrowany',
  })
  @ApiResponse({
    status: 429,
    description: 'Zbyt wiele prób rejestracji (max 3/min)',
  })
  public async register(@Body() dto: RegisterDto): Promise<UserDto> {
    return this.authService.register(dto);
  }

  /**
   * Get current user profile
   */
  @UseGuards(JwtGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Profil użytkownika',
    description: 'Zwraca dane profilu zalogowanego użytkownika.',
  })
  @ApiResponse({
    status: 200,
    description: 'Dane profilu',
    type: UserDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Brak autoryzacji - wymagany token JWT',
  })
  public getProfile(@GetCurrentUser() user: UserDto): UserDto {
    return user;
  }
}
