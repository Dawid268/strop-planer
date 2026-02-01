import {
  Controller,
  Request,
  Post,
  UseGuards,
  Body,
  Get,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard, AtGuard, RtGuard } from './auth.guard';
import {
  LoginDto,
  RegisterDto,
  TokenResponseDto,
  UserDto,
} from './dto/auth.dto';
import { GetCurrentUserId, GetCurrentUser, Public } from '@common/decorators';
import { HttpCode, HttpStatus } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';

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
  @ApiOperation({ summary: 'Zaloguj się (email/hasło)' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, type: TokenResponseDto })
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
  @ApiOperation({ summary: 'Zarejestruj nowe konto właściciela' })
  @ApiResponse({ status: 201, type: UserDto })
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
