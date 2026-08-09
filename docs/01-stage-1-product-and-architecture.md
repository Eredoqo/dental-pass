# Stage 1 — Product & Architecture Foundation

## Objective

Define the product and architectural direction before implementation.

## Product definition

Dental Passport is a shared platform with two experiences:

1. Patient
2. Clinic

It is not a separate app for every clinic.

## Multi-tenant direction

One platform serves many clinics.

Example:

```text
Platform
├── Clinic A
│   ├── Dentist
│   ├── Assistant
│   └── Patients
├── Clinic B
│   ├── Dentist
│   └── Patients
└── Clinic C
```

A patient can connect to multiple clinics.

## Core ownership model

```text
Patient
   │
   └── Dental Passport
          ├── Clinic A records
          ├── Clinic B records
          └── Clinic C records
```

The passport remains with the patient.

Clinics contribute information and receive controlled access.

## Core business entities

```text
User
Patient
Clinic
ClinicMember
DentalPassport
ClinicPatientConnection
Treatment
Procedure
Implant
TreatmentPlan
Document
DocumentVersion
Warranty
AIExtraction
AIExtractionItem
AuditLog
```

## Product boundaries

### Core
- Portable dental history
- Cross-clinic sharing
- Structured clinical records
- Secure documents
- AI-assisted extraction

### Not core initially
- Full clinic CRM
- Payments
- Accounting
- Travel marketplace
- AI diagnosis

## AI principle

AI is not the source of truth.

```text
Document
   ↓
AI extraction
   ↓
Suggested information
   ↓
Human verification
   ↓
Verified record
```

## Technical decisions

### Frontend
React + TypeScript + Vite.

### Backend
NestJS + Fastify.

Reason:
- modular architecture
- dependency injection
- guards
- validation
- maintainable domain modules
- good fit for a growing business platform

### Database
PostgreSQL.

### ORM
Prisma.

### Platform
Supabase for:
- PostgreSQL
- Auth
- Storage

Business rules remain in our backend.

### AI
OpenAI initially.

Use an internal abstraction so another provider/model can be introduced later.

### Files
Private object storage.

Do not store binary medical documents directly in PostgreSQL.

## Security principles

- Strong authentication
- Role-based authorization
- Tenant isolation
- Patient-clinic connection checks
- Private files
- Audit trail
- Data minimization
- Human verification of important AI outputs

## Initial database direction

Illustrative only; exact schema belongs in Stage 3.

```text
Patient
  1 ─── 1 DentalPassport

Patient
  1 ─── * ClinicPatientConnection

Clinic
  1 ─── * ClinicPatientConnection

Clinic
  1 ─── * ClinicMember

DentalPassport
  1 ─── * Treatment

Treatment
  1 ─── * Procedure

Procedure
  1 ─── 0..1 Implant

DentalPassport
  1 ─── * Document

Document
  1 ─── * DocumentVersion

Document
  1 ─── * AIExtraction
```

## MVP scope

### Include
Patient, clinic, connections, passport, treatments, procedures, implants, documents, treatment plans, warranties, AI extraction, audit.

### Exclude
Payments, accounting, appointments, travel integrations, marketplace, diagnosis, treatment recommendations.

## Major risk

The biggest risk is adoption, not technology.

If clinics must manually enter too much information, they may not use the system.

Therefore:

> Reduce data entry wherever possible, especially through document processing.

## Exit criteria

We have:
- stable product definition
- clear ownership model
- multi-tenant direction
- technical stack
- security principles
- explicit MVP scope

No production implementation should start until the Stage 2 workflows are defined.
