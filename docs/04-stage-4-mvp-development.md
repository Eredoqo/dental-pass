# Stage 4 — MVP Development

## Objective

Build the smallest product that proves the core value.

## Development sequence

### Phase 1 — Foundation
- Project setup
- Authentication
- Users
- Clinics
- Clinic members
- Roles
- Tenant isolation

### Phase 2 — Passport
- Patients
- Dental Passport
- Clinic-patient connections
- Passport overview
- Timeline

### Phase 3 — Clinical records
- Treatments
- Procedures
- Implants
- Treatment plans
- Warranties

### Phase 4 — Documents
- Secure upload
- Metadata
- Viewing
- Basic document organization

### Phase 5 — AI
- Processing
- Extraction
- Review
- Verification
- Provenance

### Phase 6 — Security/reliability
- Audit
- Authorization tests
- Tenant-isolation tests
- Storage permissions
- Error handling
- Monitoring

## Core vertical slice

The first complete product journey should be:

```text
Clinic registers
→ creates patient
→ patient accepts connection
→ clinic uploads historical document
→ AI extracts information
→ dentist verifies
→ passport displays structured information
→ patient views updated passport
```

If this journey is weak, do not add many more features.

## Engineering rules

- Keep modules understandable
- Avoid premature abstractions
- Keep AI provider replaceable
- Keep storage replaceable
- Test permissions heavily
- Test tenant isolation
- Use database migrations
- Document important architecture decisions

## Example initial schema direction

Illustrative only:

```prisma
model Clinic {
  id        String   @id @default(uuid()) @db.Uuid
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Patient {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @unique @db.Uuid
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

The full schema should be finalized during Stage 3 before migration work.

## Exit criteria

A controlled real-world user can complete the core journey without developer intervention.
