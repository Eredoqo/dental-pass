import { Controller, Param, Post } from '@nestjs/common';
import { User } from '@dental-passport/db';
import { CurrentUser } from '../auth/current.decorators';
import { ConnectionsService } from './connections.service';

/** Patient side: accept an invitation link (Stage 2 workflow B). */
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly connectionsService: ConnectionsService) {}

  @Post(':token/accept')
  accept(@CurrentUser() user: User, @Param('token') token: string) {
    return this.connectionsService.accept(user, token);
  }
}
