// AI extraction contracts v1 (Stage 3 §6).
// Every leaf is { value, confidence }; value is null when the document
// does not contain the information — the model never invents data.

export const EXTRACTION_SCHEMA_VERSION = 'v1';

export interface ExtractedField<T> {
  value: T | null;
  confidence: number; // 0..1
}

export interface ExtractedTreatment {
  type: ExtractedField<string>;
  date: ExtractedField<string>; // ISO date
  toothScope: ExtractedField<string>; // ToothScope value
  teeth: ExtractedField<number[]>; // FDI numbers
  notes: ExtractedField<string>;
}

export interface ClinicalReportExtraction {
  documentDate: ExtractedField<string>;
  clinicName: ExtractedField<string>;
  dentistName: ExtractedField<string>;
  treatments: ExtractedTreatment[];
}

export interface ImplantDocumentExtraction {
  manufacturer: ExtractedField<string>;
  system: ExtractedField<string>;
  model: ExtractedField<string>;
  diameterMm: ExtractedField<number>;
  lengthMm: ExtractedField<number>;
  lotNumber: ExtractedField<string>;
  placementDate: ExtractedField<string>;
  tooth: ExtractedField<number>;
}

/** Fields with confidence below this are visually flagged in review UI.
 *  Confidence never replaces human review (D-006). */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

// JSON Schemas used for OpenAI structured outputs + worker-side validation.

const field = (valueType: object) => ({
  type: 'object',
  properties: {
    value: { anyOf: [valueType, { type: 'null' }] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['value', 'confidence'],
  additionalProperties: false,
});

export const CLINICAL_REPORT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    documentDate: field({ type: 'string', format: 'date' }),
    clinicName: field({ type: 'string' }),
    dentistName: field({ type: 'string' }),
    treatments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: field({ type: 'string' }),
          date: field({ type: 'string', format: 'date' }),
          toothScope: field({
            type: 'string',
            enum: ['SINGLE', 'MULTIPLE', 'WHOLE_MOUTH', 'NOT_APPLICABLE', 'UNKNOWN'],
          }),
          teeth: field({ type: 'array', items: { type: 'integer' } }),
          notes: field({ type: 'string' }),
        },
        required: ['type', 'date', 'toothScope', 'teeth', 'notes'],
        additionalProperties: false,
      },
    },
  },
  required: ['documentDate', 'clinicName', 'dentistName', 'treatments'],
  additionalProperties: false,
} as const;

export const IMPLANT_DOCUMENT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    manufacturer: field({ type: 'string' }),
    system: field({ type: 'string' }),
    model: field({ type: 'string' }),
    diameterMm: field({ type: 'number' }),
    lengthMm: field({ type: 'number' }),
    lotNumber: field({ type: 'string' }),
    placementDate: field({ type: 'string', format: 'date' }),
    tooth: field({ type: 'integer' }),
  },
  required: [
    'manufacturer',
    'system',
    'model',
    'diameterMm',
    'lengthMm',
    'lotNumber',
    'placementDate',
    'tooth',
  ],
  additionalProperties: false,
} as const;
