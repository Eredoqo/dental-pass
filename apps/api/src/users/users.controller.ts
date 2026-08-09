import { Body, Controller, Get, Patch } from '@nestjs/common';
import { User } from '@dental-passport/db';
import { CurrentUser } from '../auth/current.decorators';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';
import { UsersService } from './users.service';

@Controller('me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Profile + contexts: patient profile (if any) and clinic memberships. */
  @Get()
  me(@CurrentUser() user: User) {
    return this.usersService.getMe(user);
  }

  /** Creates the patient profile + passport on first call, updates afterwards. */
  @Patch('patient')
  updatePatient(@CurrentUser() user: User, @Body() dto: UpdatePatientProfileDto) {
    return this.usersService.upsertPatientProfile(user, dto);
  }
}
