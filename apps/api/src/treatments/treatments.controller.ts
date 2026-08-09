import { Body, Controller, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ClinicMember } from '@dental-passport/db';
import { ClinicContextGuard } from '../auth/clinic-context.guard';
import { CurrentMember } from '../auth/current.decorators';
import { PatientAccessGuard } from '../auth/patient-access.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CorrectTreatmentDto, CreateTreatmentDto, FlagRecordDto, UpdateTreatmentDto } from './dto/treatment.dto';
import { TreatmentsService } from './treatments.service';

@Controller()
@UseGuards(ClinicContextGuard, RolesGuard)
export class TreatmentsController {
  constructor(private readonly treatmentsService: TreatmentsService) {}

  @Post('patients/:patientId/treatments')
  @UseGuards(PatientAccessGuard)
  @Roles('DENTIST')
  create(
    @CurrentMember() member: ClinicMember,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: CreateTreatmentDto,
  ) {
    return this.treatmentsService.create(member, patientId, dto);
  }

  // /treatments/:id routes have no :patientId param; the service performs the
  // equivalent layer-4 check (own clinic + ACTIVE connection).

  @Patch('treatments/:id')
  @Roles('DENTIST')
  update(
    @CurrentMember() member: ClinicMember,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTreatmentDto,
  ) {
    return this.treatmentsService.update(member, id, dto);
  }

  @Post('treatments/:id/verify')
  @Roles('DENTIST')
  verify(@CurrentMember() member: ClinicMember, @Param('id', ParseUUIDPipe) id: string) {
    return this.treatmentsService.verify(member, id);
  }

  @Post('treatments/:id/correct')
  @Roles('DENTIST')
  correct(
    @CurrentMember() member: ClinicMember,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CorrectTreatmentDto,
  ) {
    return this.treatmentsService.correct(member, id, dto);
  }

  @Post('treatments/:id/flag')
  @Roles('DENTIST')
  flag(
    @CurrentMember() member: ClinicMember,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FlagRecordDto,
  ) {
    return this.treatmentsService.flag(member, id, dto);
  }
}
