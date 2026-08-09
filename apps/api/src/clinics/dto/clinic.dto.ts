import { IsEmail, IsISO31661Alpha2, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

/** Minimum clinic information per Stage 2 §5 — nothing unnecessary at onboarding. */
export class CreateClinicDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsISO31661Alpha2()
  country: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsUrl()
  website?: string;
}

export class UpdateClinicDto extends CreateClinicDto {}
