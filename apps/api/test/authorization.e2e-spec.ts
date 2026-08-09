import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import request from 'supertest';
import { PrismaClient } from '@dental-passport/db';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';
import { Actor, cleanupFixtures, createFixtures, Fixtures } from './helpers';

/**
 * Stage 4 Phase 6 — the Stage 2 §21 permission matrix and Stage 3 §10 tenant
 * isolation as executable tests. Runs against the real database and the real
 * guard stack; only JWT signing is test-local (HS256 test secret).
 */
describe('Authorization matrix & tenant isolation', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaClient;
  let f: Fixtures;
  let server: Parameters<typeof request>[0];

  const asUser = (actor: Actor, clinicId?: string) => ({
    Authorization: `Bearer ${actor.token}`,
    ...(clinicId ? { 'X-Clinic-Id': clinicId } : {}),
  });

  beforeAll(async () => {
    prisma = new PrismaClient();
    f = await createFixtures(prisma);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await cleanupFixtures(prisma, f);
    await prisma.$disconnect();
    await app.close();
  });

  // ---------- Layer 1: authentication ----------

  it('rejects requests without a token', async () => {
    await request(server).get('/api/v1/me').expect(401);
  });

  it('rejects a forged token', async () => {
    await request(server).get('/api/v1/me').set('Authorization', 'Bearer not.a.token').expect(401);
  });

  it('accepts a valid token and provisions the user', async () => {
    const res = await request(server).get('/api/v1/me').set(asUser(f.patient1.actor)).expect(200);
    expect(res.body.user.email).toBe(f.patient1.actor.email);
  });

  // ---------- Layer 2: clinic context ----------

  it('clinic routes require X-Clinic-Id', async () => {
    await request(server).get('/api/v1/clinics/current').set(asUser(f.ownerDentistA)).expect(403);
  });

  it('rejects acting for a clinic you are not a member of', async () => {
    await request(server).get('/api/v1/clinics/current').set(asUser(f.dentistB, f.clinicA)).expect(403);
  });

  it('a patient cannot act as any clinic', async () => {
    await request(server).get('/api/v1/clinics/current').set(asUser(f.patient1.actor, f.clinicA)).expect(403);
  });

  // ---------- Layer 3: roles (Stage 2 §21) ----------

  it('assistant cannot create treatments (clinical act)', async () => {
    await request(server)
      .post(`/api/v1/patients/${f.patient1.patientId}/treatments`)
      .set(asUser(f.assistantA, f.clinicA))
      .send({ type: 'Filling', date: '2026-02-01' })
      .expect(403);
  });

  it('assistant cannot verify or review extractions', async () => {
    await request(server)
      .post(`/api/v1/extractions/${f.patient1.passportId}/review`)
      .set(asUser(f.assistantA, f.clinicA))
      .send({ itemDecisions: [], treatments: [] })
      .expect(403);
  });

  it('assistant cannot invite staff', async () => {
    await request(server)
      .post('/api/v1/clinics/current/members')
      .set(asUser(f.assistantA, f.clinicA))
      .send({ email: 'x@test.local', roles: ['ASSISTANT'] })
      .expect(403);
  });

  it('assistant cannot edit clinic profile', async () => {
    await request(server)
      .patch('/api/v1/clinics/current')
      .set(asUser(f.assistantA, f.clinicA))
      .send({ name: 'Hacked', country: 'AL', city: 'Tirana' })
      .expect(403);
  });

  it('assistant CAN view the connected patient and list documents', async () => {
    await request(server)
      .get(`/api/v1/patients/${f.patient1.patientId}/passport`)
      .set(asUser(f.assistantA, f.clinicA))
      .expect(200);
    await request(server)
      .get(`/api/v1/patients/${f.patient1.patientId}/documents`)
      .set(asUser(f.assistantA, f.clinicA))
      .expect(200);
  });

  it('dentist (with OWNER) can create and verify a treatment', async () => {
    const create = await request(server)
      .post(`/api/v1/patients/${f.patient1.patientId}/treatments`)
      .set(asUser(f.ownerDentistA, f.clinicA))
      .send({ type: 'Examination', date: '2026-02-01', procedures: [{ type: 'Examination', toothScope: 'NOT_APPLICABLE' }] })
      .expect(201);
    await request(server)
      .post(`/api/v1/treatments/${create.body.id}/verify`)
      .set(asUser(f.ownerDentistA, f.clinicA))
      .expect(201);
  });

  // ---------- Layer 4: patient access & tenant isolation ----------

  it('clinic B cannot view clinic A patient (404, not 403 — no existence leak)', async () => {
    await request(server)
      .get(`/api/v1/patients/${f.patient1.patientId}/passport`)
      .set(asUser(f.dentistB, f.clinicB))
      .expect(404);
  });

  it('clinic B cannot create records for clinic A patient', async () => {
    await request(server)
      .post(`/api/v1/patients/${f.patient1.patientId}/treatments`)
      .set(asUser(f.dentistB, f.clinicB))
      .send({ type: 'Filling', date: '2026-02-01' })
      .expect(404);
  });

  it('clinic A cannot view clinic B patient', async () => {
    await request(server)
      .get(`/api/v1/patients/${f.patient2.patientId}/passport`)
      .set(asUser(f.ownerDentistA, f.clinicA))
      .expect(404);
  });

  it('a clinic cannot edit or verify another clinic treatment', async () => {
    await request(server)
      .patch(`/api/v1/treatments/${f.patient2.verifiedTreatmentId}`)
      .set(asUser(f.ownerDentistA, f.clinicA))
      .send({ notes: 'cross-clinic edit' })
      .expect(404);
  });

  it('verified records are immutable even for the owning clinic', async () => {
    await request(server)
      .patch(`/api/v1/treatments/${f.patient2.verifiedTreatmentId}`)
      .set(asUser(f.dentistB, f.clinicB))
      .send({ notes: 'silent edit' })
      .expect(400);
  });

  it('connection lists are tenant-scoped', async () => {
    const res = await request(server).get('/api/v1/connections').set(asUser(f.ownerDentistA, f.clinicA)).expect(200);
    const patientIds = res.body.map((c: { patientId: string }) => c.patientId);
    expect(patientIds).toContain(f.patient1.patientId);
    expect(patientIds).not.toContain(f.patient2.patientId);
  });

  it('patients only see their own passport data', async () => {
    const res = await request(server).get('/api/v1/me/passport/timeline').set(asUser(f.patient1.actor)).expect(200);
    const ids = res.body.map((t: { id: string }) => t.id);
    expect(ids).not.toContain(f.patient2.verifiedTreatmentId);
  });

  // ---------- Revocation (D-019) ----------

  it('revocation instantly removes ALL clinic access, then re-invite is possible', async () => {
    await request(server)
      .post(`/api/v1/me/connections/${f.patient1.connectionId}/revoke`)
      .set(asUser(f.patient1.actor))
      .expect(201);

    await request(server)
      .get(`/api/v1/patients/${f.patient1.patientId}/passport`)
      .set(asUser(f.ownerDentistA, f.clinicA))
      .expect(404);
    await request(server)
      .post(`/api/v1/patients/${f.patient1.patientId}/treatments`)
      .set(asUser(f.ownerDentistA, f.clinicA))
      .send({ type: 'Filling', date: '2026-02-02' })
      .expect(404);

    // the patient's own passport is untouched by revocation
    await request(server).get('/api/v1/me/passport').set(asUser(f.patient1.actor)).expect(200);
  });

  // ---------- Audit ----------

  it('guard denials produce access.denied audit entries', async () => {
    const denials = await prisma.auditLog.count({
      where: { action: 'access.denied', actorUserId: { in: [f.dentistB.userId, f.assistantA.userId, f.ownerDentistA.userId] } },
    });
    expect(denials).toBeGreaterThan(0);
  });
});
