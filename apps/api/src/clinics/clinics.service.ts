import { Injectable, NotFoundException } from '@nestjs/common';
import { ClinicMember, User } from '@dental-passport/db';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClinicDto, UpdateClinicDto } from './dto/clinic.dto';

@Injectable()
export class ClinicsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(user: User, dto: CreateClinicDto) {
    const clinic = await this.prisma.$transaction(async (tx) => {
      const created = await tx.clinic.create({ data: dto });
      await tx.clinicMember.create({
        data: {
          clinicId: created.id,
          userId: user.id,
          roles: ['OWNER'],
          status: 'ACTIVE',
        },
      });
      return created;
    });

    await this.audit.log({
      actorUserId: user.id,
      action: 'clinic.create',
      resourceType: 'Clinic',
      resourceId: clinic.id,
      clinicId: clinic.id,
    });
    return clinic;
  }

  async get(clinicId: string) {
    const clinic = await this.prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) throw new NotFoundException({ code: 'CLINIC_NOT_FOUND', message: 'Clinic not found' });
    return clinic;
  }

  async update(member: ClinicMember, dto: UpdateClinicDto) {
    const clinic = await this.prisma.clinic.update({ where: { id: member.clinicId }, data: dto });
    await this.audit.log({
      actorUserId: member.userId ?? undefined,
      actorMemberId: member.id,
      action: 'clinic.update',
      resourceType: 'Clinic',
      resourceId: clinic.id,
      clinicId: clinic.id,
    });
    return clinic;
  }
}
