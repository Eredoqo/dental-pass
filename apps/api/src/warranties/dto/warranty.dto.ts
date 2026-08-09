import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** Workflow M — stores warranty information; never determines legal eligibility. */
export class CreateWarrantyDto {
  @IsString() @IsNotEmpty() @MaxLength(200) provider: string;
  @IsDateString() startDate: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsString() @MaxLength(4000) terms?: string;
  @IsOptional() @IsUUID() treatmentId?: string;
  @IsOptional() @IsUUID() implantId?: string;
  @IsOptional() @IsUUID() documentId?: string;
}
