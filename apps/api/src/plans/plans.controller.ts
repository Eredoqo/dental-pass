import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ClinicMember } from '@dental-passport/db';
import { ClinicContextGuard } from '../auth/clinic-context.guard';
import { CurrentMember } from '../auth/current.decorators';
import { PatientAccessGuard } from '../auth/patient-access.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';
import { PlansService } from './plans.service';

@Controller()
@UseGuards(ClinicContextGuard, RolesGuard)
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Post('patients/:patientId/treatment-plans')
  @UseGuards(PatientAccessGuard)
  @Roles('DENTIST')
  create(
    @CurrentMember() member: ClinicMember,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: CreatePlanDto,
  ) {
    return this.plansService.create(member, patientId, dto);
  }

  @Get('patients/:patientId/treatment-plans')
  @UseGuards(PatientAccessGuard)
  list(@CurrentMember() member: ClinicMember, @Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.plansService.listForPatient(member, patientId);
  }

  @Patch('treatment-plans/:id')
  @Roles('DENTIST')
  update(
    @CurrentMember() member: ClinicMember,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.plansService.update(member, id, dto);
  }
}
