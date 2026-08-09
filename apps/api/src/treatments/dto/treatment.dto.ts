import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const TOOTH_SCOPES = ['SINGLE', 'MULTIPLE', 'WHOLE_MOUTH', 'NOT_APPLICABLE', 'UNKNOWN'] as const;

export class CreateImplantDto {
  @IsOptional() @IsString() @MaxLength(100) manufacturer?: string;
  @IsOptional() @IsString() @MaxLength(100) system?: string;
  @IsOptional() @IsString() @MaxLength(100) model?: string;
  @IsOptional() @IsNumber() diameterMm?: number;
  @IsOptional() @IsNumber() lengthMm?: number;
  @IsOptional() @IsString() @MaxLength(100) lotNumber?: string;
  @IsOptional() @IsDateString() placementDate?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class CreateProcedureDto {
  @IsString() @IsNotEmpty() @MaxLength(200) type: string;

  @IsOptional()
  @IsIn(TOOTH_SCOPES)
  toothScope?: (typeof TOOTH_SCOPES)[number];

  /** FDI numbers (11-48); values validated in the service via shared validateFdiTeeth. */
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  teeth?: number[];

  @IsOptional() @IsString() @MaxLength(1000) notes?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateImplantDto)
  implant?: CreateImplantDto;
}

export class CreateTreatmentDto {
  @IsString() @IsNotEmpty() @MaxLength(200) type: string;
  @IsDateString() date: string;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
  @IsOptional() @IsUUID() sourceDocumentId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProcedureDto)
  procedures?: CreateProcedureDto[];
}

/** Draft-only edits; when procedures are provided they replace the existing set. */
export class UpdateTreatmentDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) type?: string;
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
  @IsOptional() @IsUUID() sourceDocumentId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProcedureDto)
  procedures?: CreateProcedureDto[];
}

/** A correction submits the full corrected record (D-018: new version, history preserved). */
export class CorrectTreatmentDto extends CreateTreatmentDto {
  @IsString() @IsNotEmpty() @MaxLength(1000) correctionReason: string;
}

export class FlagRecordDto {
  @IsString() @IsNotEmpty() @MaxLength(1000) reason: string;
}
