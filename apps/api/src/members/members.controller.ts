import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ClinicMember } from '@dental-passport/db';
import { ClinicContextGuard } from '../auth/clinic-context.guard';
import { CurrentMember } from '../auth/current.decorators';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { InviteMemberDto, UpdateMemberDto } from './dto/member.dto';
import { MembersService } from './members.service';

@Controller('clinics/current/members')
@UseGuards(ClinicContextGuard, RolesGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get()
  list(@CurrentMember() member: ClinicMember) {
    return this.membersService.list(member.clinicId);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  invite(@CurrentMember() member: ClinicMember, @Body() dto: InviteMemberDto) {
    return this.membersService.invite(member, dto);
  }

  @Patch(':id')
  @Roles('OWNER', 'ADMIN')
  update(
    @CurrentMember() member: ClinicMember,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.membersService.update(member, id, dto);
  }
}
