import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClinicMember, Prisma, Treatment } from '@dental-passport/db';
import { validateFdiTeeth } from '@dental-passport/shared';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CorrectTreatmentDto, CreateProcedureDto, CreateTreatmentDto, FlagRecordDto, UpdateTreatmentDto } from './dto/treatment.dto';

@Injectable()
export class TreatmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ---------- helpers ----------

  private validateProcedures(procedures: CreateProcedureDto[] = []) {
    for (const p of procedures) {
      if (p.teeth && !validateFdiTeeth(p.teeth)) {
        throw new BadRequestException({
          code: 'INVALID_FDI_TEETH',
          message: `Invalid FDI tooth number in [${p.teeth.join(', ')}] — expected 11-18, 21-28, 31-38, 41-48`,
        });
      }
    }
  }

  private proceduresCreateInput(procedures: CreateProcedureDto[] = []): Prisma.ProcedureCreateWithoutTreatmentInput[] {
    return procedures.map((p) => ({
      type: p.type,
      toothScope: p.toothScope ?? 'UNKNOWN',
      teeth: p.teeth ?? [],
      notes: p.notes,
      implant: p.implant
        ? {
            create: {
              ...p.implant,
              placementDate: p.implant.placementDate ? new Date(p.implant.placementDate) : undefined,
            },
          }
        : undefined,
    }));
  }

  /**
   * Resource-level authorization for /treatments/:id routes (Stage 3 §4 layer 4):
   * the treatment must belong to the acting clinic AND the clinic must still
   * have an ACTIVE connection to the patient — revocation cuts drafts too.
   */
  private async loadOwnTreatment(member: ClinicMember, treatmentId: string) {
    const treatment = await this.prisma.treatment.findUnique({
      where: { id: treatmentId },
      include: { passport: { select: { id: true, patientId: true } } },
    });
    if (!treatment || treatment.clinicId !== member.clinicId) {
      throw new NotFoundException({ code: 'TREATMENT_NOT_FOUND', message: 'Treatment not found' });
    }
    const connection = await this.prisma.clinicPatientConnection.findFirst({
      where: { clinicId: member.clinicId, patientId: treatment.passport.patientId, status: 'ACTIVE' },
    });
    if (!connection) {
      throw new NotFoundException({ code: 'TREATMENT_NOT_FOUND', message: 'Treatment not found' });
    }
    return treatment;
  }

  private async logTreatment(member: ClinicMember, action: string, treatment: Treatment, metadata?: Prisma.InputJsonValue) {
    const passport = await this.prisma.dentalPassport.findUnique({ where: { id: treatment.passportId } });
    await this.audit.log({
      actorUserId: member.userId ?? undefined,
      actorMemberId: member.id,
      action,
      resourceType: 'Treatment',
      resourceId: treatment.id,
      clinicId: member.clinicId,
      patientId: passport?.patientId,
      metadata,
    });
  }

  // ---------- workflows ----------

  /** Workflow I — create a draft treatment (DENTIST). */
  async create(member: ClinicMember, patientId: string, dto: CreateTreatmentDto) {
    this.validateProcedures(dto.procedures);
    const passport = await this.prisma.dentalPassport.findFirstOrThrow({ where: { patientId } });

    const treatment = await this.prisma.treatment.create({
      data: {
        passportId: passport.id,
        clinicId: member.clinicId,
        createdByMemberId: member.id,
        type: dto.type,
        date: new Date(dto.date),
        notes: dto.notes,
        sourceDocumentId: dto.sourceDocumentId,
        procedures: { create: this.proceduresCreateInput(dto.procedures) },
      },
      include: { procedures: { include: { implant: true } } },
    });

    await this.logTreatment(member, 'treatment.create', treatment);
    return treatment;
  }

  /** Draft-only editing; verified records are immutable (D-018). */
  async update(member: ClinicMember, treatmentId: string, dto: UpdateTreatmentDto) {
    const existing = await this.loadOwnTreatment(member, treatmentId);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException({
        code: 'RECORD_IMMUTABLE',
        message: 'Verified records cannot be edited — use a correction',
      });
    }
    this.validateProcedures(dto.procedures);

    const treatment = await this.prisma.$transaction(async (tx) => {
      if (dto.procedures) {
        await tx.implant.deleteMany({ where: { procedure: { treatmentId } } });
        await tx.procedure.deleteMany({ where: { treatmentId } });
      }
      return tx.treatment.update({
        where: { id: treatmentId },
        data: {
          type: dto.type,
          date: dto.date ? new Date(dto.date) : undefined,
          notes: dto.notes,
          sourceDocumentId: dto.sourceDocumentId,
          ...(dto.procedures ? { procedures: { create: this.proceduresCreateInput(dto.procedures) } } : {}),
        },
        include: { procedures: { include: { implant: true } } },
      });
    });

    await this.logTreatment(member, 'treatment.update', treatment);
    return treatment;
  }

  /** DRAFT → VERIFIED (DENTIST only; ownership never grants this — D-023). */
  async verify(member: ClinicMember, treatmentId: string) {
    const existing = await this.loadOwnTreatment(member, treatmentId);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException({ code: 'ALREADY_VERIFIED', message: 'Treatment is already verified' });
    }

    const treatment = await this.prisma.treatment.update({
      where: { id: treatmentId },
      data: { status: 'VERIFIED', verifiedByMemberId: member.id, verifiedAt: new Date() },
      include: { procedures: { include: { implant: true } } },
    });

    await this.logTreatment(member, 'treatment.verify', treatment);
    return treatment;
  }

  /**
   * Correction (D-018): the verified record stays untouched; a new VERIFIED
   * version is created with supersedesId pointing at it. Timeline shows only
   * the latest version; history remains queryable.
   */
  async correct(member: ClinicMember, treatmentId: string, dto: CorrectTreatmentDto) {
    const existing = await this.loadOwnTreatment(member, treatmentId);
    if (existing.status !== 'VERIFIED') {
      throw new BadRequestException({ code: 'NOT_VERIFIED', message: 'Only verified records can be corrected — edit the draft instead' });
    }
    const alreadySuperseded = await this.prisma.treatment.findFirst({ where: { supersedesId: treatmentId } });
    if (alreadySuperseded) {
      throw new BadRequestException({ code: 'ALREADY_CORRECTED', message: 'This version was already corrected — correct the latest version' });
    }
    this.validateProcedures(dto.procedures);

    const correction = await this.prisma.treatment.create({
      data: {
        passportId: existing.passportId,
        clinicId: member.clinicId,
        createdByMemberId: member.id,
        type: dto.type,
        date: new Date(dto.date),
        notes: dto.notes,
        sourceDocumentId: dto.sourceDocumentId ?? existing.sourceDocumentId,
        supersedesId: existing.id,
        status: 'VERIFIED',
        verifiedByMemberId: member.id,
        verifiedAt: new Date(),
        procedures: { create: this.proceduresCreateInput(dto.procedures) },
      },
      include: { procedures: { include: { implant: true } } },
    });

    await this.logTreatment(member, 'treatment.correct', correction, {
      supersedes: existing.id,
      reason: dto.correctionReason,
    });
    return correction;
  }

  /** Flag another clinic's verified record as a suspected error (Stage 2 §21). */
  async flag(member: ClinicMember, treatmentId: string, dto: FlagRecordDto) {
    const treatment = await this.prisma.treatment.findUnique({
      where: { id: treatmentId },
      include: { passport: { select: { patientId: true } } },
    });
    if (!treatment) {
      throw new NotFoundException({ code: 'TREATMENT_NOT_FOUND', message: 'Treatment not found' });
    }
    if (treatment.clinicId === member.clinicId) {
      throw new BadRequestException({ code: 'OWN_RECORD', message: 'Use a correction for your own records' });
    }
    const connection = await this.prisma.clinicPatientConnection.findFirst({
      where: { clinicId: member.clinicId, patientId: treatment.passport.patientId, status: 'ACTIVE' },
    });
    if (!connection) {
      throw new NotFoundException({ code: 'TREATMENT_NOT_FOUND', message: 'Treatment not found' });
    }

    const flag = await this.prisma.recordFlag.create({
      data: {
        resourceType: 'Treatment',
        resourceId: treatment.id,
        flaggedByClinicId: member.clinicId,
        flaggedByMemberId: member.id,
        reason: dto.reason,
      },
    });

    await this.audit.log({
      actorUserId: member.userId ?? undefined,
      actorMemberId: member.id,
      action: 'record.flag',
      resourceType: 'Treatment',
      resourceId: treatment.id,
      clinicId: member.clinicId,
      patientId: treatment.passport.patientId,
      metadata: { flagId: flag.id },
    });
    return flag;
  }
}
