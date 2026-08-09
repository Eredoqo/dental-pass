import { Injectable, NotFoundException } from '@nestjs/common';
import { ClinicMember } from '@dental-passport/db';
import { validateFdiTeeth } from '@dental-passport/shared';
import { BadRequestException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Workflow L — simple plans; no scheduling/financials in MVP. */
  async create(member: ClinicMember, patientId: string, dto: CreatePlanDto) {
    for (const item of dto.items ?? []) {
      if (item.teeth && !validateFdiTeeth(item.teeth)) {
        throw new BadRequestException({ code: 'INVALID_FDI_TEETH', message: 'Invalid FDI tooth number' });
      }
    }
    const passport = await this.prisma.dentalPassport.findFirstOrThrow({ where: { patientId } });

    const plan = await this.prisma.treatmentPlan.create({
      data: {
        passportId: passport.id,
        clinicId: member.clinicId,
        createdByMemberId: member.id,
        title: dto.title,
        description: dto.description,
        items: {
          create: (dto.items ?? []).map((item, index) => ({
            description: item.description,
            toothScope: item.toothScope ?? 'NOT_APPLICABLE',
            teeth: item.teeth ?? [],
            sortOrder: item.sortOrder ?? index,
          })),
        },
      },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    await this.audit.log({
      actorUserId: member.userId ?? undefined,
      actorMemberId: member.id,
      action: 'plan.create',
      resourceType: 'TreatmentPlan',
      resourceId: plan.id,
      clinicId: member.clinicId,
      patientId,
    });
    return plan;
  }

  /** Plans are clinic-internal proposals: a clinic lists only its own. */
  async listForPatient(member: ClinicMember, patientId: string) {
    const passport = await this.prisma.dentalPassport.findFirstOrThrow({ where: { patientId } });
    return this.prisma.treatmentPlan.findMany({
      where: { passportId: passport.id, clinicId: member.clinicId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(member: ClinicMember, planId: string, dto: UpdatePlanDto) {
    const plan = await this.prisma.treatmentPlan.findFirst({
      where: { id: planId, clinicId: member.clinicId },
      include: { passport: { select: { patientId: true } } },
    });
    if (!plan) throw new NotFoundException({ code: 'PLAN_NOT_FOUND', message: 'Treatment plan not found' });

    const connection = await this.prisma.clinicPatientConnection.findFirst({
      where: { clinicId: member.clinicId, patientId: plan.passport.patientId, status: 'ACTIVE' },
    });
    if (!connection) throw new NotFoundException({ code: 'PLAN_NOT_FOUND', message: 'Treatment plan not found' });

    const updated = await this.prisma.treatmentPlan.update({
      where: { id: planId },
      data: dto,
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    });

    await this.audit.log({
      actorUserId: member.userId ?? undefined,
      actorMemberId: member.id,
      action: dto.status ? 'plan.status_change' : 'plan.update',
      resourceType: 'TreatmentPlan',
      resourceId: planId,
      clinicId: member.clinicId,
      patientId: plan.passport.patientId,
      metadata: dto.status ? { status: dto.status } : undefined,
    });
    return updated;
  }
}
