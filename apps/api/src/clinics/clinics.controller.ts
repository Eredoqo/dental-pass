import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ClinicMember, User } from '@dental-passport/db';
import { ClinicContextGuard } from '../auth/clinic-context.guard';
import { CurrentMember, CurrentUser } from '../auth/current.decorators';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ClinicsService } from './clinics.service';
import { CreateClinicDto, UpdateClinicDto } from './dto/clinic.dto';

@Controller('clinics')
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  /** Any authenticated user can create a clinic; creator becomes OWNER (Stage 2 §21). */
  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateClinicDto) {
    return this.clinicsService.create(user, dto);
  }

  @Get('current')
  @UseGuards(ClinicContextGuard)
  getCurrent(@CurrentMember() member: ClinicMember) {
    return this.clinicsService.get(member.clinicId);
  }

  @Patch('current')
  @UseGuards(ClinicContextGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN')
  update(@CurrentMember() member: ClinicMember, @Body() dto: UpdateClinicDto) {
    return this.clinicsService.update(member, dto);
  }
}
