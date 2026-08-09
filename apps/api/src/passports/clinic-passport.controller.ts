import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ClinicMember } from '@dental-passport/db';
import { ClinicContextGuard } from '../auth/clinic-context.guard';
import { CurrentMember } from '../auth/current.decorators';
import { PatientAccessGuard } from '../auth/patient-access.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { PassportsService } from './passports.service';

/**
 * Clinic view of a connected patient's passport (Stage 2 workflow E).
 * All four authorization layers apply; PatientAccessGuard enforces the
 * ACTIVE connection at request time (D-019).
 */
@Controller('patients')
@UseGuards(ClinicContextGuard, RolesGuard, PatientAccessGuard)
export class ClinicPassportController {
  constructor(
    private readonly passportsService: PassportsService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get(':patientId/passport')
  async view(@CurrentMember() member: ClinicMember, @Param('patientId', ParseUUIDPipe) patientId: string) {
    const patient = await this.prisma.patient.findUniqueOrThrow({
      where: { id: patientId },
      include: {
        user: { select: { fullName: true, email: true } },
        passport: true,
      },
    });

    const passportId = patient.passport!.id;
    const [overview, timeline] = await Promise.all([
      this.passportsService.overview(passportId),
      this.passportsService.timeline(passportId, { includeDraftsOfClinicId: member.clinicId }),
    ]);

    await this.audit.log({
      actorUserId: member.userId ?? undefined,
      actorMemberId: member.id,
      action: 'passport.view',
      resourceType: 'DentalPassport',
      resourceId: passportId,
      clinicId: member.clinicId,
      patientId,
    });

    return {
      patient: {
        id: patient.id,
        fullName: patient.user.fullName,
        dateOfBirth: patient.dateOfBirth,
        sex: patient.sex,
        medicalNotes: patient.medicalNotes, // minimal profile per D-017
      },
      overview,
      timeline,
    };
  }
}
