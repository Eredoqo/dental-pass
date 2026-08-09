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

  async overview(passportId: string) {
    const [treatments, documents, warranties, implants] = await Promise.all([
      this.prisma.treatment.count({ where: { passportId, status: 'VERIFIED' } }),
      this.prisma.document.count({ where: { passportId } }),
      this.prisma.warranty.count({ where: { passportId } }),
      this.prisma.implant.count({
        where: { procedure: { treatment: { passportId, status: 'VERIFIED' } } },
      }),
    ]);
    const lastTreatment = await this.prisma.treatment.findFirst({
      where: { passportId, status: 'VERIFIED' },
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

    const treatments = await this.prisma.treatment.findMany({
      where: { passportId, ...statusFilter },
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
      procedures: t.procedures.map((p) => ({
        id: p.id,
        type: p.type,
        toothScope: p.toothScope,
        teeth: p.teeth,
        implant: p.implant,
      })),
    }));
  }
}
