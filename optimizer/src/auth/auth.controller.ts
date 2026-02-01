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

import { AuthService } from './auth.service';
import { LocalAuthGuard, AtGuard, RtGuard } from './auth.guard';
import {
  LoginDto,
  RegisterDto,
  TokenResponseDto,
  UserDto,
} from './dto/auth.dto';
import { GetCurrentUserId, GetCurrentUser, Public } from '@common/decorators';

import { Request as ExpressRequest } from 'express';

interface RequestWithUser extends ExpressRequest {
  user: UserDto;
}

@ApiTags('Auth')
@Controller({ version: '1', path: 'auth' })
export class AuthController {
  public constructor(private readonly authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ short: { limit: 5, ttl: 60000 } }) // 5 login attempts per minute
  @ApiOperation({ summary: 'Zaloguj się (email/hasło)' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, type: TokenResponseDto })
  @ApiResponse({ status: 429, description: 'Too many login attempts' })
  public async login(
    @Request() req: RequestWithUser,
  ): Promise<TokenResponseDto> {
    return this.authService.login(req.user);
  }

  @Post('logout')
  @UseGuards(AtGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Wyloguj użytkownika' })
  public logout(@GetCurrentUserId() userId: string): Promise<void> {
    return this.authService.logout(userId);
  }

  @Public()
  @UseGuards(RtGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Odśwież tokeny' })
  @ApiResponse({ status: 200, type: TokenResponseDto })
  public refreshTokens(
    @GetCurrentUserId() userId: string,
    @GetCurrentUser('refreshToken') rt: string,
  ): Promise<TokenResponseDto> {
    return this.authService.refreshTokens(userId, rt);
  }

  @Public()
  @Post('register')
  @Throttle({ short: { limit: 3, ttl: 60000 } }) // 3 registrations per minute
  @ApiOperation({ summary: 'Zarejestruj nowe konto właściciela' })
  @ApiResponse({ status: 201, type: UserDto })
  @ApiResponse({ status: 429, description: 'Too many registration attempts' })
  public async register(@Body() dto: RegisterDto): Promise<UserDto> {
    return this.authService.register(dto);
  }

  @UseGuards(AtGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pobierz profil zalogowanego użytkownika' })
  @ApiResponse({ status: 200, type: UserDto })
  public getProfile(@GetCurrentUser() user: UserDto): UserDto {
    return user;
  }
}
