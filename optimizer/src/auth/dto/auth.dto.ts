import { IsString, IsEmail, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AutoMap } from '@automapper/classes';

export class LoginDto {
  @AutoMap()
  @ApiProperty({ example: 'owner@example.com' })
  @IsEmail()
  public email!: string;

  @AutoMap()
  @ApiProperty({ example: 'password123' })
  @IsString()
  public password!: string;
}

export class RegisterDto {
  @AutoMap()
  @ApiProperty()
  @IsString()
  @MinLength(2)
  public companyName!: string;

  @AutoMap()
  @ApiProperty({ example: 'owner@example.com' })
  @IsEmail()
  public email!: string;

  @AutoMap()
  @ApiProperty()
  @IsString()
  @MinLength(6)
  public password!: string;

  @AutoMap()
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  public phone?: string;
}

export class UserDto {
  @AutoMap()
  @ApiProperty()
  id!: string;

  @AutoMap()
  @ApiProperty()
  email!: string;

  @AutoMap()
  @ApiProperty()
  companyName!: string;

  @AutoMap()
  @ApiProperty()
  role!: string;

  @AutoMap()
  @ApiProperty()
  isActive!: boolean;
}

export class TokenResponseDto {
  @ApiProperty()
  public access_token!: string;

  @ApiProperty()
  public refresh_token!: string;

  @ApiProperty({ type: UserDto })
  public user!: UserDto;
}
