import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import { PrismaClient } from '@dental-passport/db';

const secret = () => new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);

/** Mint a Supabase-shaped HS256 token the API's JwtVerifierService accepts. */
export async function mintToken(userId: string, email: string, fullName: string): Promise<string> {
  return new SignJWT({ email, user_metadata: { full_name: fullName } })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret());
}

export interface Actor {
  userId: string;
  email: string;
  token: string;
  memberId?: string;
}

export interface Fixtures {
  clinicA: string;
  clinicB: string;
  ownerDentistA: Actor; // OWNER + DENTIST at clinic A
  assistantA: Actor; // ASSISTANT at clinic A
  dentistB: Actor; // DENTIST (+OWNER) at clinic B
  patient1: { actor: Actor; patientId: string; passportId: string; connectionId: string }; // connected to A
  patient2: { actor: Actor; patientId: string; passportId: string; verifiedTreatmentId: string }; // connected to B
}

async function makeActor(prisma: PrismaClient, run: string, name: string): Promise<Actor> {
  const userId = randomUUID();
  const email = `e2e-${run}-${name}@test.local`;
  await prisma.user.create({ data: { id: userId, email, fullName: `E2E ${name}` } });
  return { userId, email, token: await mintToken(userId, email, `E2E ${name}`) };
}

/** Two clinics, three staff roles, two patients — the smallest world that can
 *  express every row of the Stage 2 §21 matrix plus tenant isolation. */
export async function createFixtures(prisma: PrismaClient): Promise<Fixtures> {
  const run = randomUUID().slice(0, 8);

  const [ownerDentistA, assistantA, dentistB, patientUser1, patientUser2] = await Promise.all([
    makeActor(prisma, run, 'owner-dentist-a'),
    makeActor(prisma, run, 'assistant-a'),
    makeActor(prisma, run, 'dentist-b'),
    makeActor(prisma, run, 'patient-1'),
    makeActor(prisma, run, 'patient-2'),
  ]);

  const clinicA = await prisma.clinic.create({ data: { name: `E2E Clinic A ${run}`, country: 'AL', city: 'Tirana' } });
  const clinicB = await prisma.clinic.create({ data: { name: `E2E Clinic B ${run}`, country: 'IT', city: 'Milano' } });

  ownerDentistA.memberId = (
    await prisma.clinicMember.create({
      data: { clinicId: clinicA.id, userId: ownerDentistA.userId, roles: ['OWNER', 'DENTIST'], status: 'ACTIVE' },
    })
  ).id;
  assistantA.memberId = (
    await prisma.clinicMember.create({
      data: { clinicId: clinicA.id, userId: assistantA.userId, roles: ['ASSISTANT'], status: 'ACTIVE' },
    })
  ).id;
  dentistB.memberId = (
    await prisma.clinicMember.create({
      data: { clinicId: clinicB.id, userId: dentistB.userId, roles: ['OWNER', 'DENTIST'], status: 'ACTIVE' },
    })
  ).id;

  const p1 = await prisma.patient.create({ data: { userId: patientUser1.userId } });
  const passport1 = await prisma.dentalPassport.create({ data: { patientId: p1.id } });
  const connection1 = await prisma.clinicPatientConnection.create({
    data: {
      clinicId: clinicA.id,
      patientId: p1.id,
      invitedEmail: patientUser1.email,
      status: 'ACTIVE',
      createdByMemberId: ownerDentistA.memberId!,
      acceptedAt: new Date(),
    },
  });

  const p2 = await prisma.patient.create({ data: { userId: patientUser2.userId } });
  const passport2 = await prisma.dentalPassport.create({ data: { patientId: p2.id } });
  await prisma.clinicPatientConnection.create({
    data: {
      clinicId: clinicB.id,
      patientId: p2.id,
      invitedEmail: patientUser2.email,
      status: 'ACTIVE',
      createdByMemberId: dentistB.memberId!,
      acceptedAt: new Date(),
    },
  });
  const verifiedTreatment = await prisma.treatment.create({
    data: {
      passportId: passport2.id,
      clinicId: clinicB.id,
      createdByMemberId: dentistB.memberId!,
      type: 'Filling',
      date: new Date('2026-01-10'),
      status: 'VERIFIED',
      verifiedByMemberId: dentistB.memberId!,
      verifiedAt: new Date(),
    },
  });

  return {
    clinicA: clinicA.id,
    clinicB: clinicB.id,
    ownerDentistA,
    assistantA,
    dentistB,
    patient1: { actor: patientUser1, patientId: p1.id, passportId: passport1.id, connectionId: connection1.id },
    patient2: { actor: patientUser2, patientId: p2.id, passportId: passport2.id, verifiedTreatmentId: verifiedTreatment.id },
  };
}

export async function cleanupFixtures(prisma: PrismaClient, f: Fixtures): Promise<void> {
  const passportIds = [f.patient1.passportId, f.patient2.passportId];
  const clinicIds = [f.clinicA, f.clinicB];
  const userIds = [
    f.ownerDentistA.userId,
    f.assistantA.userId,
    f.dentistB.userId,
    f.patient1.actor.userId,
    f.patient2.actor.userId,
  ];

  await prisma.implant.deleteMany({ where: { procedure: { treatment: { passportId: { in: passportIds } } } } });
  await prisma.procedure.deleteMany({ where: { treatment: { passportId: { in: passportIds } } } });
  await prisma.treatment.deleteMany({ where: { passportId: { in: passportIds } } });
  await prisma.warranty.deleteMany({ where: { passportId: { in: passportIds } } });
  await prisma.treatmentPlanItem.deleteMany({ where: { plan: { passportId: { in: passportIds } } } });
  await prisma.treatmentPlan.deleteMany({ where: { passportId: { in: passportIds } } });
  await prisma.aIExtractionItem.deleteMany({ where: { extraction: { document: { passportId: { in: passportIds } } } } });
  await prisma.aIExtraction.deleteMany({ where: { document: { passportId: { in: passportIds } } } });
  await prisma.documentVersion.deleteMany({ where: { document: { passportId: { in: passportIds } } } });
  await prisma.document.deleteMany({ where: { passportId: { in: passportIds } } });
  await prisma.clinicPatientConnection.deleteMany({ where: { clinicId: { in: clinicIds } } });
  await prisma.dentalPassport.deleteMany({ where: { id: { in: passportIds } } });
  await prisma.patient.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.clinicMember.deleteMany({ where: { clinicId: { in: clinicIds } } });
  await prisma.clinic.deleteMany({ where: { id: { in: clinicIds } } });
  await prisma.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}
