import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClinicMember } from '@dental-passport/db';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { InviteMemberDto, UpdateMemberDto } from './dto/member.dto';

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(clinicId: string) {
    return this.prisma.clinicMember.findMany({
      where: { clinicId },
      include: { user: { select: { id: true, email: true, fullName: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async invite(actor: ClinicMember, dto: InviteMemberDto) {
    // OWNER role can only be granted by an OWNER (Stage 2 §21: transfer/ownership is owner-only).
    if (dto.roles.includes('OWNER') && !actor.roles.includes('OWNER')) {
      throw new ForbiddenException({ code: 'OWNER_ONLY', message: 'Only an owner can grant the owner role' });
    }

    const existing = await this.prisma.clinicMember.findFirst({
      where: { clinicId: actor.clinicId, invitedEmail: dto.email, status: { not: 'DISABLED' } },
    });
    if (existing) {
      throw new BadRequestException({ code: 'ALREADY_INVITED', message: 'This email is already invited' });
    }

    // If the invitee already has an account, link immediately; otherwise the
    // membership stays INVITED and is claimed on first login (by email match).
    const invitee = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const member = await this.prisma.clinicMember.create({
      data: {
        clinicId: actor.clinicId,
        invitedEmail: dto.email,
        userId: invitee?.id,
        roles: dto.roles,
        status: invitee ? 'ACTIVE' : 'INVITED',
      },
    });

    await this.audit.log({
      actorUserId: actor.userId ?? undefined,
      actorMemberId: actor.id,
      action: 'member.invite',
      resourceType: 'ClinicMember',
      resourceId: member.id,
      clinicId: actor.clinicId,
      metadata: { roles: dto.roles },
    });
    return member;
  }

  async update(actor: ClinicMember, memberId: string, dto: UpdateMemberDto) {
    const target = await this.prisma.clinicMember.findFirst({
      where: { id: memberId, clinicId: actor.clinicId },
    });
    if (!target) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member not found' });

    const touchesOwner = target.roles.includes('OWNER') || dto.roles?.includes('OWNER');
    if (touchesOwner && !actor.roles.includes('OWNER')) {
      throw new ForbiddenException({ code: 'OWNER_ONLY', message: 'Only an owner can change owner membership' });
    }
    if (target.id === actor.id && dto.status === 'DISABLED') {
      throw new BadRequestException({ code: 'CANNOT_DISABLE_SELF', message: 'You cannot disable yourself' });
    }

    const updated = await this.prisma.clinicMember.update({ where: { id: target.id }, data: dto });
    await this.audit.log({
      actorUserId: actor.userId ?? undefined,
      actorMemberId: actor.id,
      action: dto.status ? 'member.status_change' : 'member.role_change',
      resourceType: 'ClinicMember',
      resourceId: updated.id,
      clinicId: actor.clinicId,
      metadata: { roles: dto.roles, status: dto.status },
    });
    return updated;
  }
}
