import {
  Controller,
  Request,
  Post,
  UseGuards,
  Body,
  Get,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard, JwtAuthGuard } from './auth.guard';
import { LoginDto, RegisterDto, TokenResponseDto } from './dto/auth.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  public constructor(private readonly authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @ApiOperation({ summary: 'Zaloguj się (email/hasło)' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, type: TokenResponseDto })
  public async login(@Request() req: any): Promise<TokenResponseDto> {
    return this.authService.login(req.user);
  }

  @Post('register')
  @ApiOperation({ summary: 'Zarejestruj nowe konto właściciela' })
  public async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Pobierz profil zalogowanego użytkownika' })
  public getProfile(@Request() req: any) {
    return req.user;
  }
}
