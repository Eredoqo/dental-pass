import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Layer 4 — patient/resource authorization (Stage 3 §4).
 * Requires an ACTIVE ClinicPatientConnection between the acting clinic and the
 * patient in the route (:patientId). Checked at request time, so revocation
 * takes effect immediately and completely (D-019).
 */
@Injectable()
export class PatientAccessGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const patientId = request.params?.patientId;
    if (!patientId) {
      throw new NotFoundException({ code: 'PATIENT_NOT_FOUND', message: 'Patient not specified' });
    }

    const connection = await this.prisma.clinicPatientConnection.findFirst({
      where: { clinicId: request.clinicId, patientId, status: 'ACTIVE' },
    });

    if (!connection) {
      await this.audit.accessDenied(request.user.id, 'Patient', patientId, {
        layer: 4,
        clinicId: request.clinicId,
      });
      // 404, not 403: do not reveal whether the patient exists on the platform.
      throw new NotFoundException({ code: 'PATIENT_NOT_FOUND', message: 'Patient not found' });
    }

    request.connection = connection;
    return true;
  }
}
