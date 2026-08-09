import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Layer 2 — organization authorization (Stage 3 §4).
 * Resolves the acting clinic from the X-Clinic-Id header and requires an
 * ACTIVE membership. Attaches request.member (with roles) and request.clinicId.
 */
@Injectable()
export class ClinicContextGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const clinicId = request.headers['x-clinic-id'];

    if (typeof clinicId !== 'string' || !clinicId) {
      throw new ForbiddenException({ code: 'MISSING_CLINIC_CONTEXT', message: 'X-Clinic-Id header required' });
    }

    const member = await this.prisma.clinicMember.findFirst({
      where: { clinicId, userId: request.user.id, status: 'ACTIVE' },
    });

    if (!member) {
      await this.audit.accessDenied(request.user.id, 'Clinic', clinicId, { layer: 2 });
      throw new ForbiddenException({ code: 'NOT_A_MEMBER', message: 'Not an active member of this clinic' });
    }

    request.member = member;
    request.clinicId = clinicId;
    return true;
  }
}
