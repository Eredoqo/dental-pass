import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@dental-passport/db';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PassportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPassportForUser(userId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { userId },
      include: { passport: true },
    });
    if (!patient?.passport) {
      throw new NotFoundException({ code: 'PASSPORT_NOT_FOUND', message: 'No passport yet — complete your profile first' });
    }
    return { patient, passport: patient.passport };
  }

  /** Ids of treatment versions replaced by a correction (D-018) — hidden from views. */
  private async supersededIds(passportId: string): Promise<string[]> {
    const successors = await this.prisma.treatment.findMany({
      where: { passportId, supersedesId: { not: null } },
      select: { supersedesId: true },
    });
    return successors.map((s) => s.supersedesId!);
  }

  async overview(passportId: string) {
    const superseded = await this.supersededIds(passportId);
    const current: Prisma.TreatmentWhereInput = { passportId, status: 'VERIFIED', id: { notIn: superseded } };

    const [treatments, documents, warranties, implants] = await Promise.all([
      this.prisma.treatment.count({ where: current }),
      this.prisma.document.count({ where: { passportId } }),
      this.prisma.warranty.count({ where: { passportId } }),
      this.prisma.implant.count({ where: { procedure: { treatment: current } } }),
    ]);
    const lastTreatment = await this.prisma.treatment.findFirst({
      where: current,
      orderBy: { date: 'desc' },
      select: { id: true, type: true, date: true },
    });
    return { counts: { treatments, implants, documents, warranties }, lastTreatment };
  }

  /**
   * Timeline of structured verified records with provenance (Stage 2 workflow D).
   * Patients see VERIFIED only; a clinic additionally sees its own DRAFT records.
   */
  async timeline(passportId: string, opts: { includeDraftsOfClinicId?: string } = {}) {
    const statusFilter: Prisma.TreatmentWhereInput = opts.includeDraftsOfClinicId
      ? { OR: [{ status: 'VERIFIED' }, { status: 'DRAFT', clinicId: opts.includeDraftsOfClinicId }] }
      : { status: 'VERIFIED' };
    const superseded = await this.supersededIds(passportId);

    const treatments = await this.prisma.treatment.findMany({
      where: { passportId, id: { notIn: superseded }, ...statusFilter },
      include: { procedures: { include: { implant: true } } },
      orderBy: { date: 'desc' },
    });

    const clinicIds = [...new Set(treatments.map((t) => t.clinicId))];
    const clinics = await this.prisma.clinic.findMany({
      where: { id: { in: clinicIds } },
      select: { id: true, name: true, city: true, country: true },
    });
    const clinicById = new Map(clinics.map((c) => [c.id, c]));

    return treatments.map((t) => ({
      id: t.id,
      date: t.date,
      type: t.type,
      notes: t.notes,
      status: t.status,
      clinic: clinicById.get(t.clinicId) ?? null, // provenance (D2-005)
      verifiedAt: t.verifiedAt,
      sourceDocumentId: t.sourceDocumentId,
      supersedesId: t.supersedesId, // set when this record is a correction
      procedures: t.procedures.map((p) => ({
        id: p.id,
        type: p.type,
        toothScope: p.toothScope,
        teeth: p.teeth,
        implant: p.implant,
      })),
    }));
  }

  /** Implants tab: verified, current-version implants with placement context. */
  async implants(passportId: string) {
    const superseded = await this.supersededIds(passportId);
    return this.prisma.implant.findMany({
      where: {
        procedure: { treatment: { passportId, status: 'VERIFIED', id: { notIn: superseded } } },
      },
      include: {
        procedure: {
          select: {
            teeth: true,
            toothScope: true,
            treatment: { select: { id: true, date: true, clinicId: true } },
          },
        },
      },
    });
  }
}
