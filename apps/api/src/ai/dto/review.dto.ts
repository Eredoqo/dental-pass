import { Type } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { CreateTreatmentDto } from '../../treatments/dto/treatment.dto';

export class ItemDecisionDto {
  @IsUUID() itemId: string;
  @IsIn(['ACCEPTED', 'EDITED', 'REJECTED']) decision: 'ACCEPTED' | 'EDITED' | 'REJECTED';
  @IsOptional() finalValue?: unknown;
}

/**
 * Workflow H — the dentist's review submission. The UI prefills treatment
 * forms from the extraction; the dentist edits freely and confirms. Item
 * decisions are recorded for accuracy metrics (Stage 5); the treatments
 * array is what actually becomes verified records.
 */
export class ReviewExtractionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemDecisionDto)
  itemDecisions: ItemDecisionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTreatmentDto)
  treatments: CreateTreatmentDto[];
}
