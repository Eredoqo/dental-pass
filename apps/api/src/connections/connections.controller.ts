import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ClinicMember } from '@dental-passport/db';
import { ClinicContextGuard } from '../auth/clinic-context.guard';
import { CurrentMember } from '../auth/current.decorators';
import { RolesGuard } from '../auth/roles.guard';
import { ConnectionsService } from './connections.service';
import { CreateConnectionDto, ListConnectionsQuery } from './dto/connection.dto';

/** Clinic side of the connection lifecycle (Stage 2 workflow B; any clinic role). */
@Controller('connections')
@UseGuards(ClinicContextGuard, RolesGuard)
export class ConnectionsController {
  constructor(private readonly connectionsService: ConnectionsService) {}

  @Post()
  invite(@CurrentMember() member: ClinicMember, @Body() dto: CreateConnectionDto) {
    return this.connectionsService.invite(member, dto.email);
  }

  @Get()
  list(@CurrentMember() member: ClinicMember, @Query() query: ListConnectionsQuery) {
    return this.connectionsService.list(member.clinicId, query.status);
  }

  @Delete(':id')
  cancel(@CurrentMember() member: ClinicMember, @Param('id', ParseUUIDPipe) id: string) {
    return this.connectionsService.cancelPending(member, id);
  }
}
