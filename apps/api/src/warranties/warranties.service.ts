import { Injectable } from '@nestjs/common';
import { ClinicMember } from '@dental-passport/db';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWarrantyDto } from './dto/warranty.dto';

@Injectable()
export class WarrantiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(member: ClinicMember, patientId: string, dto: CreateWarrantyDto) {
    const passport = await this.prisma.dentalPassport.findFirstOrThrow({ where: { patientId } });

    const warranty = await this.prisma.warranty.create({
      data: {
        passportId: passport.id,
        clinicId: member.clinicId,
        provider: dto.provider,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        terms: dto.terms,
        treatmentId: dto.treatmentId,
        implantId: dto.implantId,
        documentId: dto.documentId,
      },
    });

    await this.audit.log({
      actorUserId: member.userId ?? undefined,
      actorMemberId: member.id,
      action: 'warranty.create',
      resourceType: 'Warranty',
      resourceId: warranty.id,
      clinicId: member.clinicId,
      patientId,
    });
    return warranty;
  }

  /** Warranties are part of the passport's value — visible to all connected clinics. */
  async listForPatient(patientId: string) {
    const passport = await this.prisma.dentalPassport.findFirstOrThrow({ where: { patientId } });
    return this.listForPassport(passport.id);
  }

  listForPassport(passportId: string) {
    return this.prisma.warranty.findMany({
      where: { passportId },
      orderBy: { startDate: 'desc' },
    });
  }
}
