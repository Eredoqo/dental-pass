import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ClinicMember } from '@dental-passport/db';
import { ClinicContextGuard } from '../auth/clinic-context.guard';
import { CurrentMember } from '../auth/current.decorators';
import { PatientAccessGuard } from '../auth/patient-access.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateWarrantyDto } from './dto/warranty.dto';
import { WarrantiesService } from './warranties.service';

@Controller('patients/:patientId/warranties')
@UseGuards(ClinicContextGuard, RolesGuard, PatientAccessGuard)
export class WarrantiesController {
  constructor(private readonly warrantiesService: WarrantiesService) {}

  @Post()
  @Roles('OWNER', 'ADMIN', 'DENTIST')
  create(
    @CurrentMember() member: ClinicMember,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Body() dto: CreateWarrantyDto,
  ) {
    return this.warrantiesService.create(member, patientId, dto);
  }

  @Get()
  list(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.warrantiesService.listForPatient(patientId);
  }
}
