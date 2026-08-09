import { Injectable } from '@nestjs/common';
import { User } from '@dental-passport/db';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(user: User) {
    const [patient, memberships] = await Promise.all([
      this.prisma.patient.findUnique({ where: { userId: user.id } }),
      this.prisma.clinicMember.findMany({
        where: { userId: user.id, status: 'ACTIVE' },
        include: { clinic: { select: { id: true, name: true, country: true, city: true } } },
      }),
    ]);

    return {
      user: { id: user.id, email: user.email, fullName: user.fullName, locale: user.locale },
      patient,
      memberships: memberships.map((m) => ({ clinic: m.clinic, roles: m.roles })),
    };
  }

  async upsertPatientProfile(user: User, dto: UpdatePatientProfileDto) {
    const data = {
      ...dto,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
    };

    return this.prisma.$transaction(async (tx) => {
      const patient = await tx.patient.upsert({
        where: { userId: user.id },
        update: data,
        create: { userId: user.id, ...data },
      });
      // Passport is created exactly once, with the patient (Stage 1 ownership model).
      await tx.dentalPassport.upsert({
        where: { patientId: patient.id },
        update: {},
        create: { patientId: patient.id },
      });
      return patient;
    });
  }
}
