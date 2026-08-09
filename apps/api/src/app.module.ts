import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuditModule } from './audit/audit.module';
import { AuthGuard } from './auth/auth.guard';
import { AuthModule } from './auth/auth.module';
import { ClinicsModule } from './clinics/clinics.module';
import { ConnectionsModule } from './connections/connections.module';
import { DocumentsModule } from './documents/documents.module';
import { EmailModule } from './email/email.module';
import { JobsModule } from './jobs/jobs.module';
import { StorageModule } from './storage/storage.module';
import { HealthController } from './health.controller';
import { MembersModule } from './members/members.module';
import { PassportsModule } from './passports/passports.module';
import { PlansModule } from './plans/plans.module';
import { TreatmentsModule } from './treatments/treatments.module';
import { WarrantiesModule } from './warranties/warranties.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // Load the repo-root .env so `pnpm dev:api` works from apps/api without sourcing env vars.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    ClinicsModule,
    MembersModule,
    EmailModule,
    StorageModule,
    JobsModule,
    ConnectionsModule,
    DocumentsModule,
    PassportsModule,
    TreatmentsModule,
    PlansModule,
    WarrantiesModule,
  ],
  controllers: [HealthController],
  providers: [
    // Layer 1 (authentication) is global; routes opt out with @Public().
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
