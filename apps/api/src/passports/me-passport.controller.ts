import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { User } from '@dental-passport/db';
import { CurrentUser } from '../auth/current.decorators';
import { ConnectionsService } from '../connections/connections.service';
import { PassportsService } from './passports.service';

/** Patient portal endpoints — all scoped to the authenticated user's own passport. */
@Controller('me')
export class MePassportController {
  constructor(
    private readonly passportsService: PassportsService,
    private readonly connectionsService: ConnectionsService,
  ) {}

  @Get('passport')
  async overview(@CurrentUser() user: User) {
    const { passport } = await this.passportsService.getPassportForUser(user.id);
    return this.passportsService.overview(passport.id);
  }

  @Get('passport/timeline')
  async timeline(@CurrentUser() user: User) {
    const { passport } = await this.passportsService.getPassportForUser(user.id);
    return this.passportsService.timeline(passport.id);
  }

  @Get('connections')
  async connections(@CurrentUser() user: User) {
    const { patient } = await this.passportsService.getPassportForUser(user.id);
    return this.connectionsService.listForPatient(patient.id);
  }

  @Post('connections/:id/revoke')
  revoke(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.connectionsService.revoke(user, id);
  }
}
