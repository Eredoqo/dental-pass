import { Injectable } from '@nestjs/common';
import { Prisma } from '@dental-passport/db';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEvent {
  actorUserId?: string;
  actorMemberId?: string;
  action: string; // Stage 3 §8 event list
  resourceType: string;
  resourceId: string;
  clinicId?: string;
  patientId?: string;
  metadata?: Prisma.InputJsonValue;
}

/** Append-only audit log (Stage 3 §8). No update/delete methods on purpose. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(event: AuditEvent): Promise<void> {
    await this.prisma.auditLog.create({ data: event });
  }

  async accessDenied(
    actorUserId: string,
    resourceType: string,
    resourceId: string,
    metadata?: Prisma.InputJsonValue,
  ): Promise<void> {
    await this.log({ actorUserId, action: 'access.denied', resourceType, resourceId, metadata });
  }
}
