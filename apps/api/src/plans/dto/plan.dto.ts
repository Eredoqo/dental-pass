import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const TOOTH_SCOPES = ['SINGLE', 'MULTIPLE', 'WHOLE_MOUTH', 'NOT_APPLICABLE', 'UNKNOWN'] as const;
const PLAN_STATUSES = ['DRAFT', 'PROPOSED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

export class PlanItemDto {
  @IsString() @IsNotEmpty() @MaxLength(500) description: string;
  @IsOptional() @IsIn(TOOTH_SCOPES) toothScope?: (typeof TOOTH_SCOPES)[number];
  @IsOptional() @IsArray() @IsInt({ each: true }) teeth?: number[];
  @IsOptional() @IsInt() sortOrder?: number;
}

export class CreatePlanDto {
  @IsString() @IsNotEmpty() @MaxLength(200) title: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanItemDto)
  items?: PlanItemDto[];
}

export class UpdatePlanDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsIn(PLAN_STATUSES) status?: (typeof PLAN_STATUSES)[number];
}
