# Decision Log

This file summarizes major decisions across the project.

## D-001 — Product is a shared passport, not separate clinic apps

**Decision:** One platform with patient and clinic experiences.

**Reason:** Patients can interact with multiple clinics, so separate clinic apps would fragment the experience.

**Status:** Confirmed.

## D-002 — Patient-centered ownership model

**Decision:** The Dental Passport conceptually belongs to the patient.

**Reason:** The core problem is portability across clinics.

**Status:** Confirmed.

## D-003 — Multi-tenant clinic architecture

**Decision:** Clinics are organizations/tenants inside one platform.

**Reason:** Each clinic can configure its own staff and workflow without creating a separate application.

**Status:** Confirmed.

## D-004 — Albania as initial wedge

**Decision:** Investigate Albania first, especially dental tourism.

**Reason:** Strong potential cross-border use case.

**Status:** Working hypothesis, must be validated.

## D-005 — AI starts with document intelligence

**Decision:** First AI feature is document-to-structured-data extraction.

**Reason:** It attacks manual data entry and has a measurable outcome.

**Status:** Confirmed for MVP direction.

## D-006 — Human verification

**Decision:** Important AI-extracted clinical information requires human verification.

**Reason:** AI should not become the source of truth for clinical records.

**Status:** Confirmed.

## D-007 — Backend

**Decision:** NestJS + Fastify.

**Reason:** Structured modular backend is a good fit for auth, tenancy, roles, clinical domains, AI and audit.

**Status:** Confirmed unless later evidence changes it.

## D-008 — Database

**Decision:** PostgreSQL.

**Reason:** Strong relational fit for the domain.

**Status:** Confirmed.

## D-009 — ORM

**Decision:** Prisma.

**Reason:** Good TypeScript developer experience and schema/migration workflow.

**Status:** Confirmed.

## D-010 — Supabase

**Decision:** Use Supabase for PostgreSQL/Auth/Storage where appropriate.

**Reason:** Faster initial development without making business logic dependent on Supabase.

**Status:** Confirmed.

## D-011 — Avoid premature infrastructure

**Decision:** Start with a modular backend and simple deployment.

**Reason:** Product validation matters more than infrastructure complexity.

**Status:** Confirmed.

## D-012 — MVP scope discipline

**Decision:** Do not build payments, travel, marketplace, AI diagnosis, etc. initially.

**Reason:** Keep focus on the passport and document workflow.

**Status:** Confirmed.

## D-013 — Tooth notation: FDI/ISO

**Decision:** FDI/ISO notation (11–48) internally and as default display, stored as a structured value. Tooth scope (one/multiple/whole mouth/N-A/unknown) is an explicit enum.

**Reason:** FDI is the standard in Albania, Italy, and Europe generally — the entire initial market. Structured storage allows rendering other notations later.

**Status:** Confirmed (2026-08-09, resolves O-002).

## D-014 — MVP document formats

**Decision:** PDF, JPG/JPEG, PNG. HEIC accepted at upload but converted to JPG. No DICOM in MVP.

**Reason:** Covers real-world documents and phone photos without medical-imaging infrastructure.

**Status:** Confirmed (2026-08-09, resolves O-006).

## D-015 — Patient invitation via email link

**Decision:** Email with a secure link is the single MVP invitation mechanism. Front-desk QR code is a fast follow.

**Reason:** Most reliable to build, works cross-border, natural account-creation entry point.

**Status:** Confirmed (2026-08-09, resolves O-005).

## D-016 — Patient sharing: connections + PDF export only

**Decision:** MVP supports direct clinic connections plus a PDF export/download of the passport. No temporary share links.

**Reason:** The connection model covers the core story; share links are an access-control/audit surface to design deliberately later. Export provides data-portability reassurance.

**Status:** Confirmed (2026-08-09, resolves O-008).

## D-017 — Minimal patient profile

**Decision:** Name, date of birth, sex, country of residence, phone, email, preferred language, free-text medical notes/allergies. No national ID, full address, or insurance data.

**Reason:** Data minimization principle and GDPR posture.

**Status:** Confirmed for MVP (2026-08-09, resolves O-001). Pilot must validate whether clinics need a national ID/fiscal code for reconciliation.

## D-018 — Verified records are immutable

**Decision:** A verified record cannot be edited. The contributing clinic can append a correction as a new version (history preserved). Other clinics can never edit — only add their own records or flag a suspected error.

**Reason:** Clean provenance, simpler to build than a correction-review workflow; that workflow is deferred until real demand.

**Status:** Confirmed (2026-08-09, resolves O-003).

## D-019 — Revocation closes all platform access

**Decision:** On revocation the clinic loses all access through the platform, including to records it contributed. Records remain untouched in the patient's passport. The clinic can export its own contributed records at/before revocation.

**Reason:** The platform is not the clinic's legal archive — its PMS is. Patient ownership stays unambiguous.

**Status:** Confirmed direction (2026-08-09, resolves O-004). **Requires legal/privacy review before pilot.**

## D-020 — MVP AI extraction: three document categories

**Decision:** Extraction schemas for exactly three categories: (1) treatment/clinical report → treatments, procedures, teeth, dates; (2) implant passport/label → full implant structure; (3) other → metadata only, no extraction. Every field carries confidence and may be null; the model never invents missing information. Invoices, warranties, treatment plans: upload + manual classification only.

**Reason:** Focuses the first AI feature where value is highest and accuracy is measurable. Field-level JSON schema is a Stage 3 deliverable.

**Status:** Confirmed (2026-08-09, resolves O-007).

## D-021 — Single web app + monorepo

**Decision:** One React app with patient (`/p`) and clinic (`/c`) portals, in a pnpm monorepo: `apps/web`, `apps/api`, `apps/worker`, `packages/db`, `packages/shared`.

**Reason:** One deploy, shared types, and a user can be both a patient and a clinic member without two logins.

**Status:** Confirmed (2026-08-09, Stage 3).

## D-022 — pg-boss for background jobs

**Decision:** Job queue runs on pg-boss inside the existing Postgres. No Redis in MVP.

**Reason:** One less piece of infrastructure; transactional job creation with the document row; MVP volume is far below its limits. Replaceable behind the job-service abstraction.

**Status:** Confirmed (2026-08-09, Stage 3).

## D-023 — Multi-role clinic members

**Decision:** A clinic member holds a set of roles (OWNER, ADMIN, DENTIST, ASSISTANT); permissions are the union. Clinical actions (create/verify records) require DENTIST specifically — ownership alone never grants clinical authority.

**Reason:** Owner-who-is-also-dentist is the most common small-clinic case; role union models it without duplicate accounts.

**Status:** Confirmed (2026-08-09, Stage 3).

## D-024 — Clinic-only uploads in MVP

**Decision:** Only clinic members upload documents in the MVP; patients view and export.

**Reason:** Keeps the verification chain simple (every document has a responsible clinic) and matches the clinic-first onboarding flow. Patient uploads revisited after pilot.

**Status:** Confirmed (2026-08-09, Stage 3).

## D-025 — Manual document categorization in MVP

**Decision:** The uploader picks the document category; AI extraction runs only for CLINICAL_REPORT and IMPLANT_DOCUMENT. AI classification is deferred to Stage 7.

**Reason:** Removes a failure mode from the first AI feature and keeps the extraction pipeline measurable.

**Status:** Confirmed (2026-08-09, Stage 3).

## Change protocol

When changing a decision, add:

```text
Decision:
Previous:
New:
Reason:
Evidence:
Date:
Stage:
```
