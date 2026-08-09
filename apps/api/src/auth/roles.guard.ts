import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClinicRole } from '@dental-passport/db';
import { AuditService } from '../audit/audit.service';
import { ROLES_KEY } from './roles.decorator';

/**
 * Layer 3 — role authorization. Runs after ClinicContextGuard.
 * A member passes when they hold at least one required role (D-023).
 * Clinical actions must require DENTIST explicitly — ownership alone
 * never grants clinical authority (Stage 2 §21).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<ClinicRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const roles: ClinicRole[] = request.member?.roles ?? [];
    if (required.some((role) => roles.includes(role))) return true;

    await this.audit.accessDenied(request.user.id, 'Clinic', request.clinicId, {
      layer: 3,
      required,
      held: roles,
    });
    throw new ForbiddenException({ code: 'INSUFFICIENT_ROLE', message: 'Role does not permit this action' });
  }
}
