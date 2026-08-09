import { IsDateString, IsIn, IsISO31661Alpha2, IsOptional, IsString, MaxLength } from 'class-validator';

/** Minimal patient profile per D-017 — nothing beyond these fields. */
export class UpdatePatientProfileDto {
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsIn(['FEMALE', 'MALE', 'OTHER', 'UNDISCLOSED'])
  sex?: 'FEMALE' | 'MALE' | 'OTHER' | 'UNDISCLOSED';

  @IsOptional()
  @IsISO31661Alpha2()
  countryOfResidence?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  preferredLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  medicalNotes?: string;
}
