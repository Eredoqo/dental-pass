import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ClinicMember, DocumentCategory } from '@dental-passport/db';
import { EXTRACTABLE_CATEGORIES, MAX_UPLOAD_BYTES } from '@dental-passport/shared';
import { AuditService } from '../audit/audit.service';
import { JobsService } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

export interface UploadedFile {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

// Magic-byte signatures for the allowed formats (D-014). Never trust the
// declared content-type alone for medical documents.
const SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  'application/pdf': (b) => b.subarray(0, 4).toString('latin1') === '%PDF',
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
};

const EXTENSIONS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly jobs: JobsService,
    private readonly audit: AuditService,
  ) {}

  /** Workflow F — upload, store privately, queue extraction where applicable (D-020/D-025). */
  async upload(member: ClinicMember, patientId: string, file: UploadedFile, category: DocumentCategory) {
    if (file.buffer.length === 0 || file.buffer.length > MAX_UPLOAD_BYTES) {
      throw new BadRequestException({ code: 'FILE_TOO_LARGE', message: 'File must be between 1 byte and 25 MB' });
    }
    const check = SIGNATURES[file.mimeType];
    if (!check) {
      // HEIC conversion (D-014) is not wired up yet — rejected with a clear
      // message rather than silently stored. Revisit before pilot.
      throw new BadRequestException({
        code: 'UNSUPPORTED_FORMAT',
        message: 'Supported formats: PDF, JPG, PNG. Please convert other formats first.',
      });
    }
    if (!check(file.buffer)) {
      throw new BadRequestException({ code: 'FORMAT_MISMATCH', message: 'File content does not match its declared type' });
    }

    const passport = await this.prisma.dentalPassport.findFirstOrThrow({ where: { patientId } });
    const extractable = (EXTRACTABLE_CATEGORIES as readonly string[]).includes(category);

    const document = await this.prisma.document.create({
      data: {
        passportId: passport.id,
        clinicId: member.clinicId,
        uploadedByMemberId: member.id,
        category,
        originalFilename: file.filename,
        mimeType: file.mimeType,
        sizeBytes: file.buffer.length,
        status: 'UPLOADED',
      },
    });

    // Key convention: no patient names or PII in paths (Stage 3 §7).
    const storageKey = `passports/${passport.id}/documents/${document.id}/v1/${randomUUID()}.${EXTENSIONS[file.mimeType]}`;
    await this.storage.upload(storageKey, file.buffer, file.mimeType);

    const version = await this.prisma.documentVersion.create({
      data: {
        documentId: document.id,
        versionNumber: 1,
        storageKey,
        mimeType: file.mimeType,
        sizeBytes: file.buffer.length,
        uploadedByMemberId: member.id,
      },
    });

    let status: 'QUEUED' | 'NO_EXTRACTION' = 'NO_EXTRACTION';
    if (extractable) {
      await this.jobs.enqueueExtraction({ documentId: document.id, documentVersionId: version.id });
      status = 'QUEUED';
    }
    const updated = await this.prisma.document.update({ where: { id: document.id }, data: { status } });

    await this.audit.log({
      actorUserId: member.userId ?? undefined,
      actorMemberId: member.id,
      action: 'document.upload',
      resourceType: 'Document',
      resourceId: document.id,
      clinicId: member.clinicId,
      patientId,
      metadata: { category, sizeBytes: file.buffer.length, extractable },
    });
    return updated;
  }

  async listForPatient(patientId: string) {
    const passport = await this.prisma.dentalPassport.findFirstOrThrow({ where: { patientId } });
    return this.listForPassport(passport.id);
  }

  listForPassport(passportId: string) {
    return this.prisma.document.findMany({
      where: { passportId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async loadForPassportAccess(documentId: string, passportId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, passportId },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    if (!document || document.versions.length === 0) {
      throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' });
    }
    return document;
  }

  /** Signed URL for the latest version; every issuance audited (Stage 3 §7). */
  async downloadUrl(
    documentId: string,
    passportId: string,
    actor: { userId?: string; memberId?: string; clinicId?: string; patientId?: string },
  ) {
    const document = await this.loadForPassportAccess(documentId, passportId);
    const url = await this.storage.signedUrl(document.versions[0].storageKey);

    await this.audit.log({
      actorUserId: actor.userId,
      actorMemberId: actor.memberId,
      action: 'document.download',
      resourceType: 'Document',
      resourceId: document.id,
      clinicId: actor.clinicId,
      patientId: actor.patientId,
    });
    return { url, expiresInSeconds: 120, filename: document.originalFilename, mimeType: document.mimeType };
  }

  /** Own clinic's documents only, and never after verification (Stage 2 §21). */
  async delete(member: ClinicMember, patientId: string, documentId: string) {
    const passport = await this.prisma.dentalPassport.findFirstOrThrow({ where: { patientId } });
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, passportId: passport.id, clinicId: member.clinicId },
      include: { versions: true },
    });
    if (!document) throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' });
    if (document.status === 'VERIFIED') {
      throw new BadRequestException({ code: 'DOCUMENT_VERIFIED', message: 'Verified documents cannot be deleted' });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.aIExtractionItem.deleteMany({ where: { extraction: { documentId } } });
      await tx.aIExtraction.deleteMany({ where: { documentId } });
      await tx.documentVersion.deleteMany({ where: { documentId } });
      await tx.document.delete({ where: { id: documentId } });
    });
    await this.storage.remove(document.versions.map((v) => v.storageKey));

    await this.audit.log({
      actorUserId: member.userId ?? undefined,
      actorMemberId: member.id,
      action: 'document.delete',
      resourceType: 'Document',
      resourceId: documentId,
      clinicId: member.clinicId,
      patientId,
      metadata: { category: document.category, status: document.status },
    });
    return { deleted: true };
  }
}
