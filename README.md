# Dental Passport — Project Source of Truth

## 1. Project purpose

Dental Passport is a shared digital dental-record platform connecting patients and dental clinics.

The central idea is:

> The patient's dental history stays with the patient, while clinics contribute verified information to the passport.

The product should work across clinics rather than requiring a separate application for every clinic.

## 2. Current product direction

### Patient side
- Account
- Dental Passport
- Dental history/timeline
- Treatments and procedures
- Implant information
- Documents
- Treatment plans
- Warranties
- Clinic connections
- Patient-controlled sharing

### Clinic side
- Clinic organization
- Staff and roles
- Patient management
- Patient connections
- Passport access
- Treatments/procedures
- Implants
- Documents
- Treatment plans
- Warranties
- AI-assisted document processing
- Audit history

## 3. Core product principle

The passport belongs conceptually to the patient.

A clinic contributes records but should not be able to take the passport away if the patient changes clinics.

Example:

Patient
→ Clinic A adds implant
→ Clinic B adds crown
→ Clinic C adds follow-up

All information remains part of one patient history, subject to access permissions.

## 4. Initial market hypothesis

Albania is a promising starting market because dental tourism creates a strong cross-border record-portability problem.

This is a starting wedge, not a permanent limitation. The product should be designed so it can eventually work internationally.

## 5. AI direction

AI should initially remove manual administrative/document work rather than attempt diagnosis.

First AI workflow:

Document
→ AI extraction
→ human review
→ verified structured record
→ Dental Passport

Potential later AI:
- document classification
- timeline generation
- missing-information detection
- patient-friendly explanations
- clinic information assistant

## 6. Technical direction

| Area | Decision |
|---|---|
| Frontend | React + TypeScript |
| Initial frontend | Vite + React |
| Backend | NestJS + Fastify |
| Database | PostgreSQL |
| Platform | Supabase |
| ORM | Prisma |
| Storage | Private object storage, initially Supabase Storage |
| AI | OpenAI initially, behind an internal abstraction |
| Background processing | Queue/worker architecture |
| Auth | Supabase Auth + backend authorization |
| Deployment | Keep simple initially; scale only when justified |

## 7. Core domain

- User
- Patient
- Clinic
- Clinic Member
- Dental Passport
- Clinic-Patient Connection
- Treatment
- Procedure
- Implant
- Treatment Plan
- Document
- Document Version
- Warranty
- AI Extraction
- AI Extraction Item
- Audit Log

## 8. MVP scope

### In
- Patient account
- Clinic account
- Clinic members/roles
- Patient-clinic connections
- Dental Passport
- Treatments
- Procedures
- Implants
- Documents
- Basic treatment plans
- Warranties
- AI document extraction
- Audit trail

### Out initially
- Payments
- Accounting
- Full appointment management
- Marketing automation
- Travel booking
- Hotel/flight integrations
- Insurance integrations
- Marketplace
- AI diagnosis
- AI treatment recommendations

## 9. Important working rule

Do not write production code simply because an architecture idea exists.

First define:
1. The problem
2. The workflow
3. The business requirement
4. The permission model
5. The data required
6. The technical solution

Then implement.

## 10. Stage map

1. Stage 0 — Problem Validation
2. Stage 1 — Product & Architecture Foundation
3. Stage 2 — MVP Workflows
4. Stage 3 — Technical Architecture
5. Stage 4 — MVP Development
6. Stage 5 — Pilot & Validation
7. Stage 6 — Iterate & Harden
8. Stage 7 — AI Expansion
9. Stage 8 — Network & Scale
10. Stage 9 — International Expansion

## 11. Decision-change rule

If a later stage changes an earlier decision, do not silently overwrite history.

Record:
- Previous decision
- New decision
- Reason
- Evidence
- Date/stage

This documentation is the project's source of truth.
