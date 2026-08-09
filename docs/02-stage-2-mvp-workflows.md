# Stage 2 — MVP Workflows & Product Definition

**Status:** Complete (2026-08-09)  
**Purpose:** Define exactly how the first MVP behaves before database/API/UI implementation.

---

# 1. Stage objective

Stage 2 converts the product idea into concrete workflows.

At the end of this stage we should know:

- Who uses the system
- What each role can do
- How a patient enters the platform
- How a clinic connects to a patient
- How the Dental Passport is created
- How existing documents become structured information
- How AI is used
- Where humans verify AI results
- How information moves between clinics
- What happens when access is revoked
- Which screens are required
- Which features belong in the MVP
- Which features must wait

The goal is not to design every future feature.

The goal is to define the **smallest complete product that proves the central idea**.

---

# 2. MVP core hypothesis

The MVP should prove one main value proposition:

> A patient can have a portable dental history that a clinic can safely contribute to and use, while AI reduces the manual work required to convert existing dental documents into structured records.

The strongest initial workflow is:

```text
Clinic
  ↓
Connect patient
  ↓
Receive/upload existing dental documents
  ↓
AI processes document
  ↓
AI proposes structured information
  ↓
Dentist reviews/corrects
  ↓
Verified information enters Dental Passport
  ↓
Patient can view/share the updated history
```

If this workflow does not create meaningful value, adding more features will not fix the product.

---

# 3. Actors

## 3.1 Patient

The patient is the central owner of the passport concept.

Responsibilities:

- Create/manage account
- View passport
- View dental history
- View documents
- View treatments
- View implants
- View warranties
- Connect with clinics
- Accept clinic connection requests
- Share/revoke access where supported

The patient should not need to understand the underlying clinic/tenant architecture.

---

## 3.2 Clinic Owner/Admin

Manages the clinic organization.

Responsibilities:

- Create clinic
- Manage clinic profile
- Invite staff
- Assign roles
- Manage clinic settings
- View permitted patients
- Manage clinic-side access

---

## 3.3 Dentist

Clinical user.

Responsibilities:

- View permitted patient records
- Add treatments/procedures
- Add implant information
- Upload documents
- Review AI extraction
- Verify/correct extracted information
- Create treatment plans
- Add warranties where applicable

---

## 3.4 Assistant/Staff

Administrative/operational user.

Initial permissions should be more limited than a dentist.

Potential capabilities:

- Create/invite patients
- Upload documents
- View permitted patient information
- Manage administrative information

They should not automatically be allowed to verify clinical AI results.

---

# 4. Core concept: Clinic ↔ Patient connection

The connection is one of the most important concepts in the system.

A clinic should not automatically see every patient in the platform.

Instead:

```text
Patient
   │
   │ connection
   ▼
Clinic
```

The connection defines whether the clinic has access to the patient's passport.

Possible states:

```text
PENDING
ACTIVE
REVOKED
EXPIRED        # future if needed
```

MVP priority:

```text
Clinic invites patient
        ↓
Patient accepts
        ↓
ACTIVE
```

A future workflow can support:

```text
Patient invites clinic
        ↓
Clinic accepts
```

---

# 5. Workflow A — Clinic onboarding

## Goal

A clinic must be able to create its organization and start using the platform.

## Flow

```text
Clinic owner registers
        ↓
Creates clinic
        ↓
Provides basic clinic information
        ↓
Clinic dashboard
        ↓
Can invite staff
```

## Minimum clinic information

Potential MVP fields:

- Clinic name
- Country
- City
- Address
- Phone
- Email
- Website (optional)
- Logo (optional)

Do not collect unnecessary information during onboarding.

## Staff

Clinic owner can invite:

- Dentist
- Assistant/Staff
- Admin

## Success state

Clinic reaches dashboard and can create/invite its first patient.

## Failure cases

- Invalid registration
- Existing account
- Invitation failure
- Unauthorized role assignment

---

# 6. Workflow B — Patient onboarding

There are two possible flows.

## MVP preferred flow

```text
Clinic
  ↓
Creates patient/invitation
  ↓
Patient receives invitation
  ↓
Patient creates account or signs in
  ↓
Patient accepts connection
  ↓
Passport becomes active
```

This is preferred because it gives clinics an immediate reason to use the product.

## Future flow

```text
Patient creates account
  ↓
Searches/invites clinic
  ↓
Clinic accepts
```

Do not make the discovery/marketplace workflow part of the first MVP unless validation shows it is essential.

---

# 7. Workflow C — Patient Passport

## Goal

The patient should immediately understand:

> What dental information do I have?

## Main structure

```text
Dental Passport
├── Overview
├── Timeline
├── Treatments
├── Procedures
├── Implants
├── Documents
├── Warranties
└── Connected Clinics
```

## Overview

Possible information:

- Number of treatments
- Recent treatment
- Known implants
- Recent documents
- Connected clinics

Avoid making the dashboard look like a medical analytics system.

It should feel like a personal record.

---

# 8. Workflow D — Dental timeline

The timeline is a major product feature because it makes fragmented information understandable.

Example:

```text
March 2024
Implant placed
Tooth: 14
Clinic: Clinic A

June 2024
Crown placed
Tooth: 14
Clinic: Clinic A

January 2026
Follow-up
Clinic: Clinic B
```

Every important timeline item should have provenance.

Example:

```text
Treatment
├── Date
├── Clinic
├── Dentist
├── Information
└── Source document
```

The timeline should be generated from structured verified records, not from an AI-generated summary alone.

---

# 9. Workflow E — Clinic views patient

## Flow

```text
Clinic Dashboard
    ↓
Patients
    ↓
Select patient
    ↓
Authorization check
    ↓
Patient Passport
```

The clinic should see:

- Patient information required for care
- Dental history
- Documents
- Treatments
- Procedures
- Implants
- Warranties
- Treatment plans

The exact sensitive-profile fields should be minimized.

---

# 10. Workflow F — Upload existing dental document

This is the first important workflow.

## Flow

```text
Clinic opens patient
       ↓
Documents
       ↓
Upload
       ↓
Select document/file
       ↓
Document stored privately
       ↓
Processing status = QUEUED
```

Possible document types:

- Dental report
- Treatment report
- Implant document/passport
- Invoice/receipt where clinically useful
- X-ray/image
- Treatment plan
- Warranty
- Other

Not every document needs AI extraction.

---

# 11. Workflow G — AI document processing

## Core AI workflow

```text
Document uploaded
       ↓
QUEUED
       ↓
PROCESSING
       ↓
AI extraction
       ↓
EXTRACTED
       ↓
Human review
       ↓
VERIFIED
```

Failure:

```text
PROCESSING
     ↓
FAILED
     ↓
Retry / Manual handling
```

## AI must not silently create verified clinical records

The AI output is a proposal.

Example:

```text
Document
    ↓
AI

Suggested:
Tooth: 14
Treatment: Implant placement
Manufacturer: Straumann
Model: BLX
Date: 2026-03-12
```

Dentist sees:

```text
[✓] Tooth 14
[✓] Implant placement
[✓] Straumann
[✓] BLX
[✓] 2026-03-12

Confirm
```

The dentist can edit before confirmation.

---

# 12. Workflow H — AI review

This is a critical MVP screen.

## Review structure

```text
┌───────────────────────────────┐
│ Original document             │
│                               │
│ PDF/Image viewer              │
└───────────────────────────────┘

┌───────────────────────────────┐
│ AI extracted information      │
│                               │
│ Tooth       [14]              │
│ Procedure   [Implant]         │
│ Manufacturer[              ]  │
│ Date        [              ]  │
│                               │
│ [Confirm] [Edit] [Reject]     │
└───────────────────────────────┘
```

The reviewer should be able to compare the AI result with the original source.

## Important principle

The UI must make it obvious:

> This information came from AI and has not yet been verified.

After verification:

> Verified by [clinic/user] on [date].

---

# 13. Workflow I — Creating a manual treatment

Not everything will come from documents.

Dentists need a manual workflow.

```text
Patient
 ↓
Treatments
 ↓
Add treatment
 ↓
Treatment details
 ↓
Save
```

Potential treatment:

```text
Treatment
├── Type
├── Date
├── Tooth/teeth
├── Clinic
├── Dentist
├── Notes
├── Documents
└── Status
```

Do not make every possible dental field mandatory.

---

# 14. Workflow J — Procedure and tooth information

Dental information often needs to reference one or more teeth.

MVP should support:

```text
One tooth
Multiple teeth
Whole mouth
Not applicable
Unknown
```

The exact dental notation system must be finalized during domain/data-model design.

For the MVP, the important thing is not to force every document into a rigid structure if the source does not contain enough information.

---

# 15. Workflow K — Implant record

Implants are especially valuable for this product because implant information can matter years later and across clinics.

Potential MVP structure:

```text
Implant
├── Tooth
├── Manufacturer
├── System
├── Model
├── Diameter
├── Length
├── Lot/Serial number
├── Placement date
├── Clinic
├── Dentist
├── Source document
└── Verification status
```

Some fields should be optional.

The product should never invent missing information.

---

# 16. Workflow L — Treatment plan

A clinic may create a treatment plan for future work.

MVP should keep this simple.

```text
Treatment Plan
├── Title
├── Description
├── Status
├── Created date
├── Clinic
└── Procedures
```

Possible statuses:

```text
DRAFT
PROPOSED
ACCEPTED
IN_PROGRESS
COMPLETED
CANCELLED
```

Do not build a full clinic scheduling/financial treatment-management system in the MVP.

---

# 17. Workflow M — Warranty

Warranty information is potentially useful in dental tourism.

Example:

```text
Warranty
├── Treatment/Implant
├── Provider/Clinic
├── Start date
├── End date
├── Terms
├── Document
└── Status
```

The MVP should store warranty information.

It should not attempt to automatically determine legal warranty eligibility.

---

# 18. Workflow N — Patient changes clinic

This is a core reason the product exists.

Example:

```text
Patient
  ↓
Clinic A
  ↓
Treatment + Implant
  ↓
Patient connects Clinic B
  ↓
Clinic B receives permitted history
  ↓
Clinic B adds new treatment
```

The passport remains:

```text
Patient Passport
├── Clinic A records
└── Clinic B records
```

The system must preserve provenance.

---

# 19. Workflow O — Revoking clinic access

Patient should be able to revoke access.

```text
Patient
 ↓
Connected Clinics
 ↓
Clinic A
 ↓
Revoke access
 ↓
Connection = REVOKED
```

After revocation, the clinic should not receive new access to protected passport information.

The exact behavior for records that Clinic A originally contributed must be defined in Stage 3 with legal/privacy considerations.

Important:

> Revoking access must not simply delete the patient's passport history.

---

# 20. Workflow P — Dental tourism

This is our most important market-specific workflow.

Example:

```text
Patient lives in Italy
        ↓
Has previous dental records
        ↓
Travels to Albania
        ↓
Connects Albanian clinic
        ↓
Shares passport
        ↓
Clinic reviews history
        ↓
Clinic performs treatment
        ↓
Documents uploaded
        ↓
AI extracts information
        ↓
Dentist verifies
        ↓
Passport updated
        ↓
Patient returns to Italy
```

The patient should leave Albania with a better digital history than they arrived with.

This is a strong product story.

---

# 21. Permissions — FINAL MVP matrix (2026-08-09)

## Role model

Clinic roles: **OWNER**, **ADMIN**, **DENTIST**, **ASSISTANT**.

A clinic member can hold **multiple roles** (e.g. the common case of an owner who is also the treating dentist holds OWNER + DENTIST). Effective permissions are the **union** of the member's roles. OWNER and ADMIN have identical permissions except that only OWNER can delete the clinic or transfer ownership.

Clinical actions (creating and verifying clinical records) require the DENTIST role specifically — ownership alone never grants clinical authority.

## Patient permissions

| Action | Patient |
|---|---:|
| View own passport and all its contents | Yes |
| Manage own profile | Yes |
| Accept / decline clinic invitation | Yes |
| Revoke a clinic connection | Yes |
| Export own passport as PDF | Yes |
| View access log of own passport (who viewed/added what) | Yes |

Patients do **not** upload documents or create records in the MVP — clinics do. (Future decision, revisit after pilot.)

## Clinic permissions

All patient-data actions additionally require an **ACTIVE connection** between the clinic and that patient — no role grants access to unconnected patients.

| Action | Owner/Admin | Dentist | Assistant |
|---|---:|---:|---:|
| Edit clinic profile / settings | Yes | No | No |
| Invite / remove staff, assign roles | Yes | No | No |
| Delete clinic / transfer ownership | Owner only | No | No |
| View clinic dashboard | Yes | Yes | Yes |
| Invite patient (create connection) | Yes | Yes | Yes |
| Cancel a pending invitation | Yes | Yes | Yes |
| View connected patient's passport | Yes | Yes | Yes |
| Upload document | Yes | Yes | Yes |
| Set / edit document category | Yes | Yes | Yes |
| Delete document (own clinic's, before verification only) | Yes | Yes | No |
| Create draft treatment / procedure / implant | No | Yes | No |
| Edit own clinic's draft records | No | Yes | No |
| Verify AI extraction / verify records | No | Yes | No |
| Append correction to own clinic's verified record | No | Yes | No |
| Flag another clinic's record as suspected error | No | Yes | No |
| Create / manage treatment plans | No | Yes | No |
| Add / edit warranties | Yes | Yes | No |
| View audit log (clinic scope) | Yes | Own actions | No |

## Enforcement rule

Every row in this matrix is enforced **server-side** through the four authorization layers defined in Stage 3 (authentication → clinic membership → role → per-patient connection). Frontend checks are UX only.

---

# 22. FINAL MVP screens & routes (2026-08-09)

One React application with two areas: a patient portal (`/p/...`) and a clinic portal (`/c/...`). After login the app routes by account context; a user who is both a patient and a clinic member can switch areas.

## Shared / auth

```text
/login                 Login
/register              Register
/invite/:token         Accept patient invitation (register or sign in, then confirm connection)
```

## Patient portal

```text
/p                     Dashboard — recent activity, connected clinics, pending invitations
/p/passport            Passport, tabbed:
                         Timeline (default) | Treatments | Implants | Documents | Warranties
/p/passport/treatments/:id     Treatment detail (procedures, implant, provenance, source document)
/p/passport/documents/:id      Document viewer (PDF/image) + metadata + linked records
/p/clinics             Connected clinics — status, granted date, revoke action, access log
/p/settings            Profile & settings (minimal profile per O-001) + PDF export of passport
```

Design rule: the passport must feel like a personal record, not a medical analytics system. Timeline is the default view because it is the product's clearest expression of value. Every timeline entry shows provenance (clinic, date, verified-by) and unverified/draft items are visually distinct.

## Clinic portal

```text
/c/onboarding          Create clinic (name, country, city, contact — nothing more)
/c                     Dashboard — recent patients, documents awaiting AI review, pending invitations
/c/patients            Patient list (connected + pending), invite-patient action
/c/patients/:id        Patient detail, tabbed:
                         Passport (timeline) | Treatments | Documents | Plans | Warranties
/c/patients/:id/documents/:docId   Document viewer; when extraction exists, the AI review
                                   screen: original document side-by-side with editable
                                   extracted fields → Confirm / Edit / Reject per Workflow H
/c/review              AI review queue — all documents in REVIEW_REQUIRED across the clinic
/c/staff               Staff list, invite member, assign roles (Owner/Admin only)
/c/settings            Clinic profile & settings (Owner/Admin only)
```

Design rule: the AI review screen is the most important screen in the MVP — it must always show AI-proposed data as clearly unverified, allow field-level editing, and require an explicit confirm before anything enters the passport. `/c/review` exists so verification work never gets lost in per-patient navigation.

Total: 5 patient routes, 8 clinic routes, 3 auth routes. Everything else is a tab or modal.

---

# 23. MVP state model

## Connection

```text
PENDING
   ↓
ACTIVE
   ↓
REVOKED
```

## Document

```text
UPLOADED
   ↓
QUEUED
   ↓
PROCESSING
   ↓
EXTRACTED
   ↓
REVIEW_REQUIRED
   ↓
VERIFIED
```

Alternative:

```text
PROCESSING → FAILED → RETRY
```

## Treatment

```text
DRAFT
   ↓
VERIFIED
```

Future states can be added if required.

---

# 24. What is NOT in Stage 2 MVP

Explicitly defer:

- Payments
- Invoicing
- Accounting
- Appointment scheduling
- Hotel booking
- Flight booking
- Travel packages
- Patient marketplace
- Clinic marketplace
- Insurance claims
- Full CRM
- Marketing automation
- Automated diagnosis
- Automated treatment recommendations
- AI dentist replacement
- Complex chat
- Video consultations
- Full DICOM/CBCT infrastructure
- Advanced analytics
- Kubernetes/microservices

These may become future products/features, but they are distractions during MVP validation.

---

# 25. MVP success journey

The MVP is successful if this complete journey works:

```text
                    ┌──────────────┐
                    │ Clinic       │
                    └──────┬───────┘
                           │
                     creates patient
                           │
                           ▼
                    ┌──────────────┐
                    │ Patient      │
                    └──────┬───────┘
                           │
                     accepts connection
                           │
                           ▼
                    ┌──────────────┐
                    │ Passport     │
                    └──────┬───────┘
                           │
                     upload document
                           │
                           ▼
                    ┌──────────────┐
                    │ AI           │
                    │ extraction   │
                    └──────┬───────┘
                           │
                      human review
                           │
                           ▼
                    ┌──────────────┐
                    │ Verified     │
                    │ record       │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Passport     │
                    │ updated      │
                    └──────────────┘
```

This is the **vertical slice** we should build first.

---

# 26. Product decisions made in Stage 2

## D2-001 — One shared platform

We do not create a separate application for each clinic.

**Reason:** Patients can interact with multiple clinics and need one continuous passport.

## D2-002 — Clinic-first connection

The initial connection flow is clinic → patient → patient accepts.

**Reason:** It gives clinics an immediate workflow and is simpler for MVP validation.

## D2-003 — AI extraction before AI clinical intelligence

The first AI capability is document extraction.

**Reason:** It attacks manual work directly and is easier to measure safely.

## D2-004 — Human verification

AI output is never automatically treated as verified clinical information.

**Reason:** Clinical information requires trust and provenance.

## D2-005 — Provenance is part of the product

Records should identify their source clinic and, where applicable, source document.

**Reason:** Cross-clinic records without provenance could become confusing or unsafe.

## D2-006 — Passport remains continuous

Changing clinics does not create a new passport.

**Reason:** Portability is the core product value.

## D2-007 — Dental tourism is a key validation workflow

Albania ↔ foreign patient treatment is an important initial use case.

**Reason:** It provides a concrete cross-border problem to test.

---

# 27. Open decisions — RESOLVED (2026-08-09)

All eight open decisions have been resolved. The original questions are preserved; resolutions below.

### O-001 — Exact patient profile — RESOLVED

**Decision:** Minimal profile: name, date of birth, sex, country of residence, phone, email, preferred language, plus a free-text "relevant medical notes/allergies" field.

No national ID, no full address, no insurance data in MVP (data minimization / GDPR-friendly).

**Open validation question for pilot:** do Albanian clinics need a national ID / fiscal code to reconcile patients with their existing systems? Ask pilot clinics; do not guess.

### O-002 — Tooth notation — RESOLVED

**Decision:** FDI/ISO notation (11–48) internally and as default display.

- Store as a structured value, not free text, so other notations (e.g. Universal) can be rendered later.
- Tooth scope is an explicit enum: one tooth / multiple teeth / whole mouth / not applicable / unknown — no magic values.

### O-003 — Clinical record editing — RESOLVED

**Decision:** A verified record is **immutable once verified**.

- The contributing clinic can append a correction as a new version; the old version is preserved and visible in history.
- Another clinic can never edit it — it can only add its own records or flag a suspected error.
- The "correction request/review" workflow from Stage 3 notes is deferred until real demand appears.

### O-004 — Access after revocation — RESOLVED (pending legal review)

**Decision:** After revocation, the clinic loses **all** access through the platform, including to records it contributed. The records remain untouched in the patient's passport.

- The platform is not the clinic's legal archive — its PMS is.
- Offer a clinic-side export of *its own contributed records* at/before revocation.
- **Must pass legal/privacy review before pilot.**

### O-005 — Patient invitation — RESOLVED

**Decision:** Email with a secure link is the single MVP mechanism.

Reliable, works cross-border, and is the natural account-creation entry point. A front-desk QR code (same link, rendered differently) is a fast follow, not MVP.

### O-006 — Document formats — RESOLVED

**Decision:** PDF, JPG/JPEG, PNG.

- HEIC accepted at upload (phone photos) but converted to JPG; HEIC is not stored.
- No DICOM in MVP; X-rays uploaded as plain images are treated as images.

### O-007 — AI extraction schema — RESOLVED (direction; field-level schema in Stage 3)

**Decision:** MVP defines extraction schemas for exactly three document categories:

1. **Treatment/clinical report** → treatments + procedures + teeth + dates
2. **Implant passport/label** → full implant structure from Workflow K (manufacturer, system, model, diameter, length, lot/serial, placement date)
3. **Other** → no extraction; metadata only

Rules:
- Every extracted field carries a confidence value and may be null.
- The model must never fill gaps ("never invent missing information").
- Invoices, warranties, and treatment plans can be uploaded but get manual classification only — no extraction in MVP.

The exact field-level JSON schema is a Stage 3 deliverable.

### O-008 — Patient sharing — RESOLVED

**Decision:** MVP supports direct clinic connections only, plus a PDF export/download of the passport.

No temporary share links in MVP — they are an access-control and audit surface to be designed deliberately later. Export gives patients the "I can leave with my data" reassurance.

---

# 28. Stage 2 deliverables

Before leaving Stage 2 we should have:

- [x] Actors defined
- [x] Core product workflow defined
- [x] Clinic onboarding direction
- [x] Patient onboarding direction
- [x] Passport structure
- [x] Clinic connection concept
- [x] Document workflow
- [x] AI workflow
- [x] Human verification concept
- [x] Treatment workflow
- [x] Implant workflow
- [x] Treatment-plan direction
- [x] Warranty direction
- [x] Cross-clinic workflow
- [x] Dental-tourism workflow
- [x] Initial permission model
- [x] MVP screen inventory
- [x] MVP state models
- [x] Explicit out-of-scope list
- [x] Open decisions identified

Still required before coding:

- [x] Final permission matrix (section 21, finalized 2026-08-09)
- [x] Final domain/data model (Stage 3 doc)
- [x] Final AI extraction schema (categories in O-007; field-level schema in Stage 3 doc)
- [x] Final document categories (O-006, O-007)
- [x] Final MVP screen/UX flows (section 22, finalized 2026-08-09)
- [x] Final access/revocation rules (O-003, O-004 — pending legal review before pilot)
- [x] Stage 3 technical architecture (Stage 3 doc, completed 2026-08-09)

---

# 29. Exit criteria

Stage 2 is complete when we can answer:

> If a clinic and patient use Dental Passport tomorrow, exactly what can they do, in what order, and what happens to the information at every step?

Once that answer is stable, we move to Stage 3.

Stage 3 will turn these workflows into:

```text
Workflows
    ↓
Domain model
    ↓
Database model
    ↓
Authorization model
    ↓
API boundaries
    ↓
AI architecture
    ↓
Storage architecture
    ↓
Infrastructure
```

Only after that should Stage 4 begin coding.
