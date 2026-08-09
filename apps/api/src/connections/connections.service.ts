import { createHash, randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClinicMember, User } from '@dental-passport/db';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';

const INVITATION_TTL_DAYS = 14;

@Injectable()
export class ConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async invite(member: ClinicMember, inviteeEmail: string) {
    const clinic = await this.prisma.clinic.findUniqueOrThrow({ where: { id: member.clinicId } });

    // Block duplicates: a pending invite to this email, or an active connection
    // to a patient whose account uses this email.
    const duplicate = await this.prisma.clinicPatientConnection.findFirst({
      where: {
        clinicId: member.clinicId,
        status: { in: ['PENDING', 'ACTIVE'] },
        OR: [{ invitedEmail: inviteeEmail }, { patient: { user: { email: inviteeEmail } } }],
      },
    });
    if (duplicate) {
      throw new BadRequestException({
        code: 'ALREADY_CONNECTED',
        message: duplicate.status === 'PENDING' ? 'Invitation already pending' : 'Patient already connected',
      });
    }

    const token = randomBytes(32).toString('base64url');
    const connection = await this.prisma.clinicPatientConnection.create({
      data: {
        clinicId: member.clinicId,
        invitedEmail: inviteeEmail,
        invitationTokenHash: this.hashToken(token),
        invitationExpiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 3600 * 1000),
        createdByMemberId: member.id,
      },
    });

    const invitationUrl = `${this.config.get('APP_BASE_URL')}/invite/${token}`;
    await this.email.sendPatientInvitation(inviteeEmail, clinic.name, invitationUrl);

    await this.audit.log({
      actorUserId: member.userId ?? undefined,
      actorMemberId: member.id,
      action: 'connection.invite',
      resourceType: 'ClinicPatientConnection',
      resourceId: connection.id,
      clinicId: member.clinicId,
    });

    // invitationUrl is returned so the clinic can hand the link to the patient
    // directly (front desk / WhatsApp). The token is stored only as a hash.
    return { id: connection.id, status: connection.status, invitedEmail: inviteeEmail, invitationUrl };
  }

  list(clinicId: string, status?: 'PENDING' | 'ACTIVE' | 'REVOKED') {
    return this.prisma.clinicPatientConnection.findMany({
      where: { clinicId, ...(status ? { status } : {}) },
      include: {
        patient: {
          select: { id: true, user: { select: { fullName: true, email: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancelPending(member: ClinicMember, connectionId: string) {
    const connection = await this.prisma.clinicPatientConnection.findFirst({
      where: { id: connectionId, clinicId: member.clinicId, status: 'PENDING' },
    });
    if (!connection) {
      throw new NotFoundException({ code: 'INVITATION_NOT_FOUND', message: 'Pending invitation not found' });
    }

    await this.prisma.clinicPatientConnection.delete({ where: { id: connection.id } });
    await this.audit.log({
      actorUserId: member.userId ?? undefined,
      actorMemberId: member.id,
      action: 'connection.cancel',
      resourceType: 'ClinicPatientConnection',
      resourceId: connection.id,
      clinicId: member.clinicId,
    });
    return { cancelled: true };
  }

  async accept(user: User, token: string) {
    const connection = await this.prisma.clinicPatientConnection.findFirst({
      where: { invitationTokenHash: this.hashToken(token), status: 'PENDING' },
      include: { clinic: { select: { id: true, name: true } } },
    });
    if (!connection) {
      throw new NotFoundException({ code: 'INVITATION_NOT_FOUND', message: 'Invitation not found or already used' });
    }
    if (connection.invitationExpiresAt && connection.invitationExpiresAt < new Date()) {
      throw new BadRequestException({ code: 'INVITATION_EXPIRED', message: 'Invitation has expired' });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Ensure the accepting user has a patient profile + passport.
      const patient = await tx.patient.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id },
      });
      await tx.dentalPassport.upsert({
        where: { patientId: patient.id },
        update: {},
        create: { patientId: patient.id },
      });

      // Re-invite after revocation: reuse the existing (clinic, patient) row to
      // respect the unique constraint and preserve connection history fields.
      const existing = await tx.clinicPatientConnection.findFirst({
        where: { clinicId: connection.clinicId, patientId: patient.id },
      });
      if (existing) {
        await tx.clinicPatientConnection.delete({ where: { id: connection.id } });
        return tx.clinicPatientConnection.update({
          where: { id: existing.id },
          data: { status: 'ACTIVE', acceptedAt: new Date(), revokedAt: null, invitationTokenHash: null },
        });
      }

      return tx.clinicPatientConnection.update({
        where: { id: connection.id },
        data: { patientId: patient.id, status: 'ACTIVE', acceptedAt: new Date(), invitationTokenHash: null },
      });
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'connection.accept',
      resourceType: 'ClinicPatientConnection',
      resourceId: result.id,
      clinicId: connection.clinicId,
      patientId: result.patientId ?? undefined,
      // Token possession is what authorizes acceptance; a different email than
      // the invited one is allowed but recorded.
      metadata: { invitedEmail: connection.invitedEmail, acceptedByEmail: user.email },
    });

    return { connectionId: result.id, clinic: connection.clinic, status: result.status };
  }

  /** Patient-side: list own connections. */
  listForPatient(patientId: string) {
    return this.prisma.clinicPatientConnection.findMany({
      where: { patientId },
      include: { clinic: { select: { id: true, name: true, country: true, city: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Patient-side: revoke an active connection (D-019). */
  async revoke(user: User, connectionId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { userId: user.id } });
    const connection = patient
      ? await this.prisma.clinicPatientConnection.findFirst({
          where: { id: connectionId, patientId: patient.id, status: 'ACTIVE' },
        })
      : null;
    if (!connection) {
      throw new NotFoundException({ code: 'CONNECTION_NOT_FOUND', message: 'Active connection not found' });
    }

    const revoked = await this.prisma.clinicPatientConnection.update({
      where: { id: connection.id },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'connection.revoke',
      resourceType: 'ClinicPatientConnection',
      resourceId: revoked.id,
      clinicId: revoked.clinicId,
      patientId: revoked.patientId ?? undefined,
    });
    return revoked;
  }
}
