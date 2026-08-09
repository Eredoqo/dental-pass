import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ClinicMember } from '@dental-passport/db';
import { validateFdiTeeth } from '@dental-passport/shared';
import { AuditService } from '../audit/audit.service';
import { JobsService } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReviewExtractionDto } from './dto/review.dto';

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly audit: AuditService,
  ) {}

  /** Documents needing attention, clinic-wide (Stage 2 §22: /c/review). */
  async reviewQueue(member: ClinicMember) {
    const documents = await this.prisma.document.findMany({
      where: { clinicId: member.clinicId, status: { in: ['QUEUED', 'PROCESSING', 'REVIEW_REQUIRED', 'FAILED'] } },
      include: {
        passport: { select: { patient: { select: { id: true, user: { select: { fullName: true } } } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return documents.map((d) => ({
      id: d.id,
      filename: d.originalFilename,
      category: d.category,
      status: d.status,
      createdAt: d.createdAt,
      patientId: d.passport.patient.id,
      patientName: d.passport.patient.user.fullName,
    }));
  }

  /** Layer-4 equivalent for document routes without :patientId (see Stage 3 §4). */
  private async loadOwnDocument(member: ClinicMember, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, clinicId: member.clinicId },
      include: { passport: { select: { patientId: true } } },
    });
    if (!document) throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' });
    const connection = await this.prisma.clinicPatientConnection.findFirst({
      where: { clinicId: member.clinicId, patientId: document.passport.patientId, status: 'ACTIVE' },
    });
    if (!connection) throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' });
    return document;
  }

  async extractionForDocument(member: ClinicMember, documentId: string) {
    const document = await this.loadOwnDocument(member, documentId);
    const extraction = await this.prisma.aIExtraction.findFirst({
      where: { documentId },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    if (!extraction) {
      throw new NotFoundException({ code: 'EXTRACTION_NOT_FOUND', message: 'No extraction for this document yet' });
    }
    return {
      document: {
        id: document.id,
        filename: document.originalFilename,
        category: document.category,
        status: document.status,
        patientId: document.passport.patientId,
      },
      extraction: {
        id: extraction.id,
        status: extraction.status,
        provider: extraction.provider,
        model: extraction.model,
        error: extraction.error,
        items: extraction.items,
      },
    };
  }

  /**
   * Workflow H confirm: item decisions recorded, dentist-approved treatments
   * created directly as VERIFIED with provenance to the source document
   * (D-006: nothing enters the passport without explicit human confirmation).
   */
  async review(member: ClinicMember, extractionId: string, dto: ReviewExtractionDto) {
    const extraction = await this.prisma.aIExtraction.findUnique({ where: { id: extractionId } });
    if (!extraction) throw new NotFoundException({ code: 'EXTRACTION_NOT_FOUND', message: 'Extraction not found' });
    const document = await this.loadOwnDocument(member, extraction.documentId);
    if (document.status !== 'REVIEW_REQUIRED') {
      throw new BadRequestException({ code: 'NOT_REVIEWABLE', message: `Document is ${document.status}, not awaiting review` });
    }
    if (extraction.reviewedAt) {
      throw new BadRequestException({ code: 'ALREADY_REVIEWED', message: 'Extraction already reviewed' });
    }
    for (const t of dto.treatments) {
      for (const p of t.procedures ?? []) {
        if (p.teeth && !validateFdiTeeth(p.teeth)) {
          throw new BadRequestException({ code: 'INVALID_FDI_TEETH', message: 'Invalid FDI tooth number' });
        }
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      for (const decision of dto.itemDecisions) {
        await tx.aIExtractionItem.updateMany({
          where: { id: decision.itemId, extractionId },
          data: { decision: decision.decision, finalValue: (decision.finalValue ?? undefined) as never },
        });
      }

      const treatments = [];
      for (const t of dto.treatments) {
        treatments.push(
          await tx.treatment.create({
            data: {
              passportId: document.passportId,
              clinicId: member.clinicId,
              createdByMemberId: member.id,
              type: t.type,
              date: new Date(t.date),
              notes: t.notes,
              sourceDocumentId: document.id, // provenance (D2-005)
              status: 'VERIFIED',
              verifiedByMemberId: member.id,
              verifiedAt: new Date(),
              procedures: {
                create: (t.procedures ?? []).map((p) => ({
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
                })),
              },
            },
            include: { procedures: { include: { implant: true } } },
          }),
        );
      }

      await tx.aIExtraction.update({
        where: { id: extractionId },
        data: { reviewedByMemberId: member.id, reviewedAt: new Date() },
      });
      await tx.document.update({ where: { id: document.id }, data: { status: 'VERIFIED' } });
      return treatments;
    });

    await this.audit.log({
      actorUserId: member.userId ?? undefined,
      actorMemberId: member.id,
      action: 'extraction.reviewed',
      resourceType: 'AIExtraction',
      resourceId: extractionId,
      clinicId: member.clinicId,
      patientId: document.passport.patientId,
      metadata: {
        documentId: document.id,
        treatmentsCreated: created.length,
        decisions: dto.itemDecisions.map((d) => d.decision),
      },
    });
    return { treatments: created, documentStatus: 'VERIFIED' };
  }

  /** Re-queue a FAILED document (Stage 2 workflow G failure path). */
  async retry(member: ClinicMember, documentId: string) {
    const document = await this.loadOwnDocument(member, documentId);
    if (document.status !== 'FAILED') {
      throw new BadRequestException({ code: 'NOT_FAILED', message: 'Only failed documents can be retried' });
    }
    const version = await this.prisma.documentVersion.findFirstOrThrow({
      where: { documentId },
      orderBy: { versionNumber: 'desc' },
    });

    await this.prisma.document.update({ where: { id: documentId }, data: { status: 'QUEUED' } });
    await this.jobs.enqueueExtraction({ documentId, documentVersionId: version.id });

    await this.audit.log({
      actorUserId: member.userId ?? undefined,
      actorMemberId: member.id,
      action: 'extraction.queued',
      resourceType: 'Document',
      resourceId: documentId,
      clinicId: member.clinicId,
      metadata: { retry: true },
    });
    return { status: 'QUEUED' };
  }
}
