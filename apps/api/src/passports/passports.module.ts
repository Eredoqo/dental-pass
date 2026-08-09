import { Module } from '@nestjs/common';
import { ConnectionsModule } from '../connections/connections.module';
import { ClinicPassportController } from './clinic-passport.controller';
import { MePassportController } from './me-passport.controller';
import { PassportsService } from './passports.service';

@Module({
  imports: [ConnectionsModule],
  controllers: [MePassportController, ClinicPassportController],
  providers: [PassportsService],
})
export class PassportsModule {}
