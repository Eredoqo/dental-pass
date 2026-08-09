import { Module } from '@nestjs/common';
import { ConnectionsModule } from '../connections/connections.module';
import { WarrantiesModule } from '../warranties/warranties.module';
import { ClinicPassportController } from './clinic-passport.controller';
import { MePassportController } from './me-passport.controller';
import { PassportsService } from './passports.service';

@Module({
  imports: [ConnectionsModule, WarrantiesModule],
  controllers: [MePassportController, ClinicPassportController],
  providers: [PassportsService],
})
export class PassportsModule {}
