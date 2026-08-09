import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ClinicMember } from '@dental-passport/db';
import { ClinicContextGuard } from '../auth/clinic-context.guard';
import { CurrentMember } from '../auth/current.decorators';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AiService } from './ai.service';
import { ReviewExtractionDto } from './dto/review.dto';

@Controller()
@UseGuards(ClinicContextGuard, RolesGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('ai/review-queue')
  reviewQueue(@CurrentMember() member: ClinicMember) {
    return this.aiService.reviewQueue(member);
  }

  @Get('documents/:id/extraction')
  extraction(@CurrentMember() member: ClinicMember, @Param('id', ParseUUIDPipe) id: string) {
    return this.aiService.extractionForDocument(member, id);
  }

  /** Verification is a clinical act: DENTIST only (D-023, D-006). */
  @Post('extractions/:id/review')
  @Roles('DENTIST')
  review(
    @CurrentMember() member: ClinicMember,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewExtractionDto,
  ) {
    return this.aiService.review(member, id, dto);
  }

  @Post('documents/:id/retry-extraction')
  @Roles('DENTIST')
  retry(@CurrentMember() member: ClinicMember, @Param('id', ParseUUIDPipe) id: string) {
    return this.aiService.retry(member, id);
  }
}
