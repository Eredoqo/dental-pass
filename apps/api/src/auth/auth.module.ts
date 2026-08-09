import { Global, Module } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { ClinicContextGuard } from './clinic-context.guard';
import { JwtVerifierService } from './jwt-verifier.service';
import { PatientAccessGuard } from './patient-access.guard';
import { RolesGuard } from './roles.guard';

@Global()
@Module({
  providers: [JwtVerifierService, AuthGuard, ClinicContextGuard, RolesGuard, PatientAccessGuard],
  exports: [JwtVerifierService, AuthGuard, ClinicContextGuard, RolesGuard, PatientAccessGuard],
})
export class AuthModule {}
