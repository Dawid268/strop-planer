import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  Length,
  Matches,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @Length(2, 100)
  public companyName!: string;

  @IsOptional()
  @IsString()
  @Length(2, 50)
  public contactPerson?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/, { message: 'NIP musi mieć 10 cyfr' })
  public nip?: string;

  @IsEmail()
  public email!: string;

  @IsString()
  @Matches(/^\+?[\d\s-]{9,20}$/, { message: 'Nieprawidłowy format telefonu' })
  public phone!: string;

  @IsOptional()
  @IsString()
  public phoneSecondary?: string;

  @IsString()
  @Length(2, 100)
  public street!: string;

  @IsString()
  @Matches(/^\d{2}-\d{3}$/, { message: 'Kod pocztowy w formacie XX-XXX' })
  public postalCode!: string;

  @IsString()
  @Length(2, 50)
  public city!: string;

  @IsOptional()
  @IsString()
  public notes?: string;
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  public companyName?: string;

  @IsOptional()
  @IsString()
  @Length(2, 50)
  public contactPerson?: string;

  @IsOptional()
  @IsString()
  public nip?: string;

  @IsOptional()
  @IsEmail()
  public email?: string;

  @IsOptional()
  @IsString()
  public phone?: string;

  @IsOptional()
  @IsString()
  public phoneSecondary?: string;

  @IsOptional()
  @IsString()
  public street?: string;

  @IsOptional()
  @IsString()
  public postalCode?: string;

  @IsOptional()
  @IsString()
  public city?: string;

  @IsOptional()
  @IsString()
  public notes?: string;

  @IsOptional()
  @IsBoolean()
  public isActive?: boolean;
}

export interface CustomerResponseDto {
  readonly id: string;
  readonly companyName: string;
  readonly contactPerson: string | null;
  readonly nip: string | null;
  readonly email: string;
  readonly phone: string;
  readonly phoneSecondary: string | null;
  readonly street: string;
  readonly postalCode: string;
  readonly city: string;
  readonly notes: string | null;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly activeRentalsCount?: number;
}
