import { SetMetadata } from '@nestjs/common';
import { ClinicRole } from '@dental-passport/db';

export const ROLES_KEY = 'requiredRoles';

/** Layer 3 — the member must hold at least ONE of these roles (union semantics, D-023). */
export const Roles = (...roles: ClinicRole[]) => SetMetadata(ROLES_KEY, roles);
