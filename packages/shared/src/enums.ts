// String enums mirroring prisma/schema.prisma — usable in the web app
// without importing the Prisma client.

export const CLINIC_ROLES = ['OWNER', 'ADMIN', 'DENTIST', 'ASSISTANT'] as const;
export type ClinicRole = (typeof CLINIC_ROLES)[number];

export const CONNECTION_STATUSES = ['PENDING', 'ACTIVE', 'REVOKED'] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const DOCUMENT_CATEGORIES = [
  'CLINICAL_REPORT',
  'IMPLANT_DOCUMENT',
  'XRAY_IMAGE',
  'TREATMENT_PLAN',
  'WARRANTY',
  'INVOICE',
  'OTHER',
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** Categories that go through AI extraction (D-020, D-025). */
export const EXTRACTABLE_CATEGORIES: readonly DocumentCategory[] = [
  'CLINICAL_REPORT',
  'IMPLANT_DOCUMENT',
];

export const DOCUMENT_STATUSES = [
  'UPLOADED',
  'QUEUED',
  'PROCESSING',
  'REVIEW_REQUIRED',
  'VERIFIED',
  'FAILED',
  'NO_EXTRACTION',
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const TOOTH_SCOPES = [
  'SINGLE',
  'MULTIPLE',
  'WHOLE_MOUTH',
  'NOT_APPLICABLE',
  'UNKNOWN',
] as const;
export type ToothScope = (typeof TOOTH_SCOPES)[number];

export const PLAN_STATUSES = [
  'DRAFT',
  'PROPOSED',
  'ACCEPTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

/** Suggested treatment types — free text is allowed, this drives autocomplete. */
export const SUGGESTED_TREATMENT_TYPES = [
  'Examination',
  'Cleaning / Hygiene',
  'Filling',
  'Root canal',
  'Extraction',
  'Implant placement',
  'Crown placement',
  'Bridge',
  'Denture',
  'Veneer',
  'Whitening',
  'Orthodontic treatment',
  'Periodontal treatment',
  'Follow-up',
  'Other',
] as const;

/** Upload constraints (D-014, Stage 3 §7). */
export const ALLOWED_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic', // converted to JPG at ingest, never stored
] as const;
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
