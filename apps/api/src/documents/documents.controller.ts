import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ClinicMember, DocumentCategory } from '@dental-passport/db';
import { DOCUMENT_CATEGORIES } from '@dental-passport/shared';
import { ClinicContextGuard } from '../auth/clinic-context.guard';
import { CurrentMember } from '../auth/current.decorators';
import { PatientAccessGuard } from '../auth/patient-access.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentsService } from './documents.service';

@Controller('patients/:patientId/documents')
@UseGuards(ClinicContextGuard, RolesGuard, PatientAccessGuard)
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly prisma: PrismaService,
  ) {}

  /** Multipart upload: one `file` part + a `category` field (D-025: uploader picks). */
  @Post()
  async upload(
    @CurrentMember() member: ClinicMember,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Req() req: { file: () => Promise<MultipartFile | undefined> },
  ) {
    const part = await req.file();
    if (!part) {
      throw new BadRequestException({ code: 'NO_FILE', message: 'Multipart "file" field required' });
    }
    const buffer = await part.toBuffer();
    const rawCategory = (part.fields?.category as { value?: string } | undefined)?.value ?? 'OTHER';
    if (!(DOCUMENT_CATEGORIES as readonly string[]).includes(rawCategory)) {
      throw new BadRequestException({ code: 'INVALID_CATEGORY', message: `Unknown category ${rawCategory}` });
    }

    return this.documentsService.upload(
      member,
      patientId,
      { buffer, filename: part.filename, mimeType: part.mimetype },
      rawCategory as DocumentCategory,
    );
  }

  @Get()
  list(@Param('patientId', ParseUUIDPipe) patientId: string) {
    return this.documentsService.listForPatient(patientId);
  }

  @Get(':id/download')
  async download(
    @CurrentMember() member: ClinicMember,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const passport = await this.prisma.dentalPassport.findFirstOrThrow({ where: { patientId } });
    return this.documentsService.downloadUrl(id, passport.id, {
      userId: member.userId ?? undefined,
      memberId: member.id,
      clinicId: member.clinicId,
      patientId,
    });
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN', 'DENTIST')
  delete(
    @CurrentMember() member: ClinicMember,
    @Param('patientId', ParseUUIDPipe) patientId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentsService.delete(member, patientId, id);
  }
}

interface MultipartFile {
  toBuffer: () => Promise<Buffer>;
  filename: string;
  mimetype: string;
  fields?: Record<string, unknown>;
}
