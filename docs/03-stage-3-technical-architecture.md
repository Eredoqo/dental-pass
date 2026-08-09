# Stage 3 — Technical Architecture

**Status:** Complete (2026-08-09)  
**Purpose:** Translate the Stage 2 workflows into a concrete implementation architecture: data model, authorization, API boundaries, AI pipeline, storage, and infrastructure.

---

# 1. Target system

```text
                 Web App (React)
              /p patient   /c clinic
                     │
                     ▼
                 API (NestJS)
                     │
       ┌─────────────┼──────────────┐
       ▼             ▼              ▼
  PostgreSQL     Supabase        pg-boss
  (Prisma)       Storage       (job queue,
       │        (private)      in Postgres)
       │                            │
       │                            ▼
       │                       AI Worker
       │                     (NestJS process)
       │                            │
       └────────────────────────────┘
                     │
                     ▼
              OpenAI (behind
           internal AI provider
             abstraction)
```

## Technology decisions (confirmed)

| Component | Choice |
|---|---|
| Frontend | React + TypeScript + Vite — **one app**, patient + clinic areas |
| Backend | NestJS + Fastify |
| Database | PostgreSQL (Supabase-hosted) |
| ORM | Prisma |
| Auth | Supabase Auth (JWT verified by our API; authorization is ours) |
| Storage | Supabase Storage, private bucket, backend-mediated access |
| Jobs | **pg-boss** — queue lives in Postgres, no Redis to operate |
| AI | OpenAI via internal `AiProvider` interface |
| API style | Resource-oriented REST, JSON |

**Why pg-boss over Redis/BullMQ:** one less piece of infrastructure, transactional job creation with the document row, and MVP volume is nowhere near its limits. Replaceable later behind the job-service abstraction.

---

# 2. Repository layout

Single monorepo (pnpm workspaces):

```text
dental-passport/
├── apps/
│   ├── web/        React + Vite (patient portal /p, clinic portal /c)
│   ├── api/        NestJS HTTP API
│   └── worker/     NestJS standalone process (pg-boss consumer, AI pipeline)
├── packages/
│   ├── db/         Prisma schema, client, migrations
│   └── shared/     Shared TypeScript types, enums, AI extraction schemas
└── docs/           These stage documents
```

`api` and `worker` share domain modules; the worker imports the same services rather than duplicating logic.

---

# 3. Data model (Prisma)

Full MVP schema. Field-level refinements during implementation are fine; **structural** changes (entities, relations, state machines) require a DECISIONS.md entry.

```prisma
// ---------- Enums ----------

enum ClinicRole        { OWNER ADMIN DENTIST ASSISTANT }
enum MemberStatus      { INVITED ACTIVE DISABLED }
enum ConnectionStatus  { PENDING ACTIVE REVOKED }
enum Sex               { FEMALE MALE OTHER UNDISCLOSED }

enum DocumentCategory  { CLINICAL_REPORT IMPLANT_DOCUMENT XRAY_IMAGE
                         TREATMENT_PLAN WARRANTY INVOICE OTHER }
enum DocumentStatus    { UPLOADED QUEUED PROCESSING REVIEW_REQUIRED
                         VERIFIED FAILED NO_EXTRACTION }

enum TreatmentStatus   { DRAFT VERIFIED }
enum ToothScope        { SINGLE MULTIPLE WHOLE_MOUTH NOT_APPLICABLE UNKNOWN }
enum PlanStatus        { DRAFT PROPOSED ACCEPTED IN_PROGRESS COMPLETED CANCELLED }
enum WarrantyStatus    { ACTIVE EXPIRED VOID }

enum ExtractionStatus  { PENDING RUNNING SUCCEEDED FAILED }
enum ItemDecision      { PENDING ACCEPTED EDITED REJECTED }
enum FlagStatus        { OPEN RESOLVED DISMISSED }

// ---------- Identity ----------

model User {
  id        String   @id @db.Uuid            // = Supabase auth.users.id
  email     String   @unique
  fullName  String
  locale    String   @default("en")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Patient {
  id                 String    @id @default(uuid()) @db.Uuid
  userId             String    @unique @db.Uuid
  dateOfBirth        DateTime?
  sex                Sex       @default(UNDISCLOSED)
  countryOfResidence String?                  // ISO 3166-1 alpha-2
  phone              String?
  preferredLanguage  String?
  medicalNotes       String?                  // free-text allergies/notes (D-017)
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
}

model DentalPassport {
  id        String   @id @default(uuid()) @db.Uuid
  patientId String   @unique @db.Uuid
  createdAt DateTime @default(now())
}

// ---------- Clinic / tenancy ----------

model Clinic {
  id             String   @id @default(uuid()) @db.Uuid
  name           String
  country        String                        // ISO 3166-1 alpha-2
  city           String
  address        String?
  phone          String?
  email          String?
  website        String?
  logoStorageKey String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model ClinicMember {
  id        String       @id @default(uuid()) @db.Uuid
  clinicId  String       @db.Uuid
  userId    String?      @db.Uuid              // null until staff invite accepted
  invitedEmail String?
  roles     ClinicRole[]                       // multi-role: OWNER+DENTIST is common
  status    MemberStatus @default(INVITED)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  @@unique([clinicId, userId])
}

model ClinicPatientConnection {
  id                  String           @id @default(uuid()) @db.Uuid
  clinicId            String           @db.Uuid
  patientId           String?          @db.Uuid  // null until invitation accepted
  invitedEmail        String
  invitationTokenHash String?                    // hash only; raw token in email link
  invitationExpiresAt DateTime?
  status              ConnectionStatus @default(PENDING)
  createdByMemberId   String           @db.Uuid
  acceptedAt          DateTime?
  revokedAt           DateTime?
  createdAt           DateTime         @default(now())

  @@unique([clinicId, patientId])
}

// ---------- Clinical records ----------
// Verified records are immutable (D-018). Corrections create a new row
// with supersedesId → previous version; history is never overwritten.

model Treatment {
  id                 String          @id @default(uuid()) @db.Uuid
  passportId         String          @db.Uuid
  clinicId           String          @db.Uuid   // provenance (D2-005)
  createdByMemberId  String          @db.Uuid
  type               String                      // suggested list in shared package, free text allowed
  date               DateTime
  notes              String?
  status             TreatmentStatus @default(DRAFT)
  verifiedByMemberId String?         @db.Uuid
  verifiedAt         DateTime?
  sourceDocumentId   String?         @db.Uuid    // provenance to source document
  supersedesId       String?         @db.Uuid    // correction chain (D-018)
  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt
}

model Procedure {
  id          String     @id @default(uuid()) @db.Uuid
  treatmentId String     @db.Uuid
  type        String
  toothScope  ToothScope @default(UNKNOWN)
  teeth       Int[]                              // FDI numbers 11–48 (D-013)
  notes       String?
}

model Implant {
  id            String    @id @default(uuid()) @db.Uuid
  procedureId   String    @unique @db.Uuid
  manufacturer  String?
  system        String?
  model         String?
  diameterMm    Decimal?  @db.Decimal(4, 2)
  lengthMm      Decimal?  @db.Decimal(4, 2)
  lotNumber     String?
  placementDate DateTime?
  notes         String?
  // All optional: never invent missing information (Workflow K)
}

model TreatmentPlan {
  id                String     @id @default(uuid()) @db.Uuid
  passportId        String     @db.Uuid
  clinicId          String     @db.Uuid
  createdByMemberId String     @db.Uuid
  title             String
  description       String?
  status            PlanStatus @default(DRAFT)
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt
}

model TreatmentPlanItem {
  id          String     @id @default(uuid()) @db.Uuid
  planId      String     @db.Uuid
  description String
  toothScope  ToothScope @default(NOT_APPLICABLE)
  teeth       Int[]
  sortOrder   Int        @default(0)
}

model Warranty {
  id          String         @id @default(uuid()) @db.Uuid
  passportId  String         @db.Uuid
  clinicId    String         @db.Uuid
  treatmentId String?        @db.Uuid
  implantId   String?        @db.Uuid
  provider    String
  startDate   DateTime
  endDate     DateTime?
  terms       String?
  documentId  String?        @db.Uuid
  status      WarrantyStatus @default(ACTIVE)
  createdAt   DateTime       @default(now())
}

model RecordFlag {
  id             String     @id @default(uuid()) @db.Uuid
  resourceType   String                          // "Treatment" | "Implant" | ...
  resourceId     String     @db.Uuid
  flaggedByClinicId String  @db.Uuid
  flaggedByMemberId String  @db.Uuid
  reason         String
  status         FlagStatus @default(OPEN)
  createdAt      DateTime   @default(now())
}

// ---------- Documents ----------

model Document {
  id                 String           @id @default(uuid()) @db.Uuid
  passportId         String           @db.Uuid
  clinicId           String           @db.Uuid  // uploads are clinic-only in MVP
  uploadedByMemberId String           @db.Uuid
  category           DocumentCategory
  originalFilename   String
  mimeType           String
  sizeBytes          Int
  status             DocumentStatus   @default(UPLOADED)
  currentVersion     Int              @default(1)
  createdAt          DateTime         @default(now())
  updatedAt          DateTime         @updatedAt
}

model DocumentVersion {
  id                 String   @id @default(uuid()) @db.Uuid
  documentId         String   @db.Uuid
  versionNumber      Int
  storageKey         String                       // no patient names in paths
  mimeType           String
  sizeBytes          Int
  uploadedByMemberId String   @db.Uuid
  createdAt          DateTime @default(now())

  @@unique([documentId, versionNumber])
}

// ---------- AI ----------

model AIExtraction {
  id                 String           @id @default(uuid()) @db.Uuid
  documentId         String           @db.Uuid
  documentVersionId  String           @db.Uuid
  status             ExtractionStatus @default(PENDING)
  provider           String                       // "openai"
  model              String                       // exact model id used
  promptVersion      String                       // versioned prompts, always
  rawOutput          Json?
  error              String?
  startedAt          DateTime?
  finishedAt         DateTime?
  reviewedByMemberId String?          @db.Uuid
  reviewedAt         DateTime?
  createdAt          DateTime         @default(now())
}

model AIExtractionItem {
  id                  String       @id @default(uuid()) @db.Uuid
  extractionId        String       @db.Uuid
  itemType            String                      // "treatment" | "procedure" | "implant" | "documentDate"
  fieldPath           String                      // e.g. "treatments[0].teeth"
  proposedValue       Json
  confidence          Float?
  decision            ItemDecision @default(PENDING)
  finalValue          Json?                       // value after human edit
  appliedResourceType String?                     // what verified record it became
  appliedResourceId   String?      @db.Uuid
}

// ---------- Audit ----------
// Append-only. The application never updates or deletes rows here.

model AuditLog {
  id            String   @id @default(uuid()) @db.Uuid
  actorUserId   String?  @db.Uuid
  actorMemberId String?  @db.Uuid
  action        String                            // e.g. "document.upload", "treatment.verify"
  resourceType  String
  resourceId    String   @db.Uuid
  clinicId      String?  @db.Uuid
  patientId     String?  @db.Uuid
  metadata      Json?
  createdAt     DateTime @default(now())

  @@index([patientId, createdAt])
  @@index([clinicId, createdAt])
}
```

### Data-model rules

- UUIDs for all public entities; timestamps on all mutable entities.
- `teeth Int[]` holds FDI numbers; `toothScope` is the explicit enum from D-013 — no magic values.
- JSON only for AI raw output, extraction values, and audit metadata — never for relational data.
- Verified records: application-level immutability, enforced in the service layer (update attempts on `status = VERIFIED` are rejected; corrections go through `supersedesId`).
- Document state machine (refines Stage 2 section 23: `EXTRACTED` and `REVIEW_REQUIRED` collapsed into one state, since extraction completion *is* what requires review):

```text
UPLOADED → QUEUED → PROCESSING → REVIEW_REQUIRED → VERIFIED
                        ↓
                      FAILED → (retry → QUEUED)
Category OTHER/INVOICE/…: UPLOADED → NO_EXTRACTION   (terminal; D-020)
```

---

# 4. Authorization model

Four layers, implemented as NestJS guards executed in order:

| Layer | Guard | Question | Mechanism |
|---|---|---|---|
| 1 | `AuthGuard` | Who is this? | Verify Supabase JWT (JWKS); attach `userId` |
| 2 | `ClinicContextGuard` | Which clinic are they acting for? | `X-Clinic-Id` header → load ACTIVE `ClinicMember`; attach member + roles |
| 3 | `RolesGuard` | Can their role do this? | `@Roles(DENTIST)` decorator checked against member's role set (union semantics, per Stage 2 §21) |
| 4 | `PatientAccessGuard` | Can this clinic touch this patient? | Resolve target passport/patient from route param → require ACTIVE `ClinicPatientConnection` |

Patient-portal routes skip layers 2–3 and use a `PatientSelfGuard`: the resource must belong to the authenticated user's own passport.

Rules:

- Supabase Auth authenticates; **all authorization lives in our API**. The database is reached only by the API/worker (service credentials) — no client-side Postgres access, so Supabase RLS is not part of the security model.
- Every guard denial and every clinical mutation writes an `AuditLog` row.
- Layer 4 is also applied inside the worker before it touches patient data.
- Revocation (D-019): `PatientAccessGuard` checks `status = ACTIVE` at request time, so a revoked clinic loses access immediately and completely, including to records it contributed.

---

# 5. API boundaries

Resource-oriented REST under `/api/v1`. Modules mirror the domain:

```text
auth, users, patients, passports, clinics, clinic-members,
connections, treatments, procedures, implants, treatment-plans,
warranties, documents, ai-extractions, audit
```

Core MVP endpoints:

```text
# Patient portal (PatientSelfGuard)
GET    /me                                      profile + contexts (patient? member of which clinics?)
PATCH  /me/patient                              update patient profile
GET    /me/passport                             passport overview
GET    /me/passport/timeline                    verified records, newest first, with provenance
GET    /me/passport/treatments|implants|documents|warranties
GET    /me/passport/documents/:id/download      short-lived signed URL
GET    /me/connections                          connected clinics + access log summary
POST   /me/connections/:id/revoke
GET    /me/passport/export                      PDF export (D-016)
POST   /invitations/:token/accept               accept clinic invitation

# Clinic portal (AuthGuard + ClinicContextGuard + RolesGuard + PatientAccessGuard)
POST   /clinics                                 create clinic (creator → OWNER member)
GET    /clinics/current                         clinic profile           [any role]
PATCH  /clinics/current                         update profile           [OWNER|ADMIN]
GET    /clinics/current/members                                          [any role]
POST   /clinics/current/members                 invite staff             [OWNER|ADMIN]
PATCH  /clinics/current/members/:id             roles/status             [OWNER|ADMIN]

POST   /connections                             invite patient by email  [any role]
GET    /connections?status=                     list clinic's patients   [any role]
DELETE /connections/:id                         cancel PENDING invite    [any role]

GET    /patients/:patientId/passport            full permitted view      [any role, ACTIVE conn]
POST   /patients/:patientId/documents           multipart upload → UPLOADED → QUEUED [any role]
GET    /patients/:patientId/documents/:id/download                       [any role]
DELETE /patients/:patientId/documents/:id       pre-verification only    [OWNER|ADMIN|DENTIST]

POST   /patients/:patientId/treatments          create draft             [DENTIST]
PATCH  /treatments/:id                          edit draft only          [DENTIST]
POST   /treatments/:id/verify                                            [DENTIST]
POST   /treatments/:id/correct                  new version, supersedes  [DENTIST]
POST   /records/:type/:id/flag                  flag another clinic's record [DENTIST]

POST   /patients/:patientId/treatment-plans                              [DENTIST]
POST   /patients/:patientId/warranties                                   [OWNER|ADMIN|DENTIST]

GET    /ai/review-queue                         clinic's REVIEW_REQUIRED docs [any role, read]
GET    /documents/:id/extraction                proposed items + confidence   [any role, read]
POST   /extractions/:id/review                  per-item accept/edit/reject → creates verified records [DENTIST]
POST   /extractions/:id/retry                   re-queue FAILED           [DENTIST]

GET    /audit?scope=clinic                                               [OWNER|ADMIN]
```

Conventions: DTO validation with `class-validator` on every input; cursor pagination on lists; errors as `{ statusCode, code, message }` with stable machine-readable `code`.

---

# 6. AI pipeline

## Flow

```text
POST document (multipart)
  → API: store file (private bucket), create Document + DocumentVersion
  → if category ∈ {CLINICAL_REPORT, IMPLANT_DOCUMENT}:
        same DB transaction: status = QUEUED + pg-boss job `document.extract`
    else: status = NO_EXTRACTION (terminal)
  → API returns immediately (never waits for AI)

Worker consumes `document.extract`:
  → status = PROCESSING, AIExtraction created (status RUNNING)
  → download file via storage service
  → AiProvider.extract(file, category schema, prompt vN)
  → validate output against JSON Schema (below); parse into AIExtractionItems
  → extraction SUCCEEDED, document status = REVIEW_REQUIRED
  → on error: retry ×3 (exponential backoff) → FAILED + audit event

Dentist reviews (Workflow H screen):
  → per-item ACCEPTED / EDITED / REJECTED
  → accepted+edited items become verified Treatment/Procedure/Implant rows
    with sourceDocumentId provenance, verifiedByMemberId, verifiedAt
  → document status = VERIFIED
```

## `AiProvider` abstraction

```ts
interface AiProvider {
  extract(input: {
    file: Buffer; mimeType: string;
    category: 'CLINICAL_REPORT' | 'IMPLANT_DOCUMENT';
    schemaVersion: string;
  }): Promise<ExtractionResult>;
}
```

OpenAI is the first implementation (vision-capable model, structured outputs against our JSON Schema). The rest of the system depends only on the interface. Model id and prompt version are recorded on every `AIExtraction` row.

## Extraction JSON Schemas (v1)

Every leaf is `{ "value": <type|null>, "confidence": 0..1 }`. The model must return `value: null` for anything not present in the document — **never invent missing information**.

**CLINICAL_REPORT v1:**

```json
{
  "documentDate":  { "value": "date|null", "confidence": 0.0 },
  "clinicName":    { "value": "string|null", "confidence": 0.0 },
  "dentistName":   { "value": "string|null", "confidence": 0.0 },
  "treatments": [
    {
      "type":       { "value": "string|null", "confidence": 0.0 },
      "date":       { "value": "date|null", "confidence": 0.0 },
      "toothScope": { "value": "SINGLE|MULTIPLE|WHOLE_MOUTH|NOT_APPLICABLE|UNKNOWN", "confidence": 0.0 },
      "teeth":      { "value": "int[] (FDI)|null", "confidence": 0.0 },
      "notes":      { "value": "string|null", "confidence": 0.0 }
    }
  ]
}
```

**IMPLANT_DOCUMENT v1:**

```json
{
  "manufacturer":  { "value": "string|null", "confidence": 0.0 },
  "system":        { "value": "string|null", "confidence": 0.0 },
  "model":         { "value": "string|null", "confidence": 0.0 },
  "diameterMm":    { "value": "number|null", "confidence": 0.0 },
  "lengthMm":      { "value": "number|null", "confidence": 0.0 },
  "lotNumber":     { "value": "string|null", "confidence": 0.0 },
  "placementDate": { "value": "date|null", "confidence": 0.0 },
  "tooth":         { "value": "int (FDI)|null", "confidence": 0.0 }
}
```

Schemas live in `packages/shared` and are versioned; a schema change bumps `promptVersion`.

UI rule: confidence < 0.7 renders visually flagged for extra attention; confidence is never a substitute for review — every field requires explicit human confirmation regardless (D-006).

---

# 7. Storage architecture

- One **private** Supabase Storage bucket: `documents`. No public access; no RLS-based client access — only the API/worker with service credentials.
- Key convention (no patient names, no PII in paths):

```text
passports/{passportId}/documents/{documentId}/v{versionNumber}/{uuid}.{ext}
```

- Uploads go **through the API** (multipart, 25 MB limit): the API authenticates, authorizes (layer 4), virus-of-type-checks (MIME sniffing, extension whitelist per D-014), converts HEIC → JPG, then writes to storage.
- Downloads: API authorizes, then issues a signed URL with **120-second TTL**. Every issuance is audited (`document.download`).
- Clinic export at revocation (D-019): batch signed URLs for the clinic's own contributed documents, produced before the connection is closed.

---

# 8. Audit events (MVP list)

```text
auth.login
connection.invite | connection.accept | connection.revoke
member.invite | member.role_change | member.disable
document.upload | document.download | document.delete | document.category_change
extraction.queued | extraction.succeeded | extraction.failed | extraction.reviewed
treatment.create | treatment.verify | treatment.correct
plan.create | plan.status_change
warranty.create
record.flag
access.denied            (guard denials, layers 2–4)
```

Shape per Stage 3 principle: `actor, action, resourceType, resourceId, clinicId, patientId, timestamp, metadata`. Append-only.

---

# 9. Infrastructure & environments

Keep it deliberately small (D-011):

| Piece | MVP hosting |
|---|---|
| Web (static) | Vercel or Netlify |
| API | Single container (Railway / Render / Fly) |
| Worker | Second container, same platform, same image with `WORKER=1` |
| Postgres / Auth / Storage | Supabase (hosted) |

Environments: `local` (Supabase CLI local stack), `staging`, `production`. Migrations run via Prisma Migrate in CI before deploy.

Environment variables (API/worker):

```text
DATABASE_URL, DIRECT_URL
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_JWKS_URL
OPENAI_API_KEY
APP_BASE_URL                 (for invitation links)
EMAIL_PROVIDER_API_KEY       (invitations — e.g. Resend/Postmark)
```

No Kubernetes, no microservices, no CDN until real usage justifies them (Stage 8).

---

# 10. Testing strategy (architecture-level)

Highest-value tests, in priority order (mirrors Stage 6 priorities):

1. **Authorization matrix tests** — e2e tests that walk Stage 2 §21 row by row: every action × every role × connected/unconnected patient. This matrix *is* the security spec; the tests are its executable form.
2. **Tenant isolation tests** — clinic A can never read/write clinic B's or an unconnected patient's data, including via indirect routes (documents, extractions, audit).
3. **State-machine tests** — document and connection transitions; verified-record immutability; correction chains.
4. **Extraction contract tests** — worker output validates against schema v1; null-handling; malformed AI output never creates records.
5. Unit tests for services as normal.

---

# 11. Stage 3 decisions

Recorded in DECISIONS.md as D-021 … D-025:

- **D-021** — Single web app + pnpm monorepo (`web`, `api`, `worker`, shared packages).
- **D-022** — pg-boss (Postgres-backed) for background jobs; no Redis in MVP.
- **D-023** — Clinic members hold multiple roles; permissions are the union; clinical actions require DENTIST specifically.
- **D-024** — Document uploads are clinic-only in the MVP; patients view/export only.
- **D-025** — Document category is chosen manually by the uploader in MVP; AI classification is deferred to Stage 7.

---

# 12. Exit criteria — met

Every Stage 2 workflow now has: a technical implementation boundary (module + endpoints), an authorization rule (guard layer + matrix row), a storage strategy, and a defined data flow. The remaining pre-pilot dependency is the **legal/privacy review of D-019 (revocation)** — it does not block development, but blocks the pilot.

**Next: Stage 4 — build the vertical slice** (clinic registers → invites patient → patient accepts → document upload → AI extraction → dentist verifies → patient sees updated passport).
