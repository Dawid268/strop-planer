import { IsString, IsEmail, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'owner@example.com' })
  @IsEmail()
  public email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  public password!: string;
}

export class RegisterDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  public companyName!: string;

  @ApiProperty({ example: 'owner@example.com' })
  @IsEmail()
  public email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  public password!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  public phone?: string;
}

export class TokenResponseDto {
  @ApiProperty()
  public access_token!: string;

  @ApiProperty()
  public user!: {
    id: string;
    email: string;
    companyName: string;
    role: string;
  };
}
