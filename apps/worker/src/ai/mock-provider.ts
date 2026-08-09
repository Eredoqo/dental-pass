import { EXTRACTION_SCHEMA_VERSION } from '@dental-passport/shared';
import { AiProvider, ExtractionInput, ExtractionResult } from './types';

/**
 * Deterministic provider used when OPENAI_API_KEY is not set (local dev).
 * Exercises the full pipeline — status transitions, items, review UI —
 * without calling a real model. Clearly labelled in AIExtraction.provider.
 */
export class MockAiProvider implements AiProvider {
  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const output =
      input.category === 'CLINICAL_REPORT'
        ? {
            documentDate: { value: '2026-03-12', confidence: 0.93 },
            clinicName: { value: 'Mock Dental Clinic', confidence: 0.85 },
            dentistName: { value: null, confidence: 0 },
            treatments: [
              {
                type: { value: 'Implant placement', confidence: 0.9 },
                date: { value: '2026-03-12', confidence: 0.88 },
                toothScope: { value: 'SINGLE', confidence: 0.9 },
                teeth: { value: [14], confidence: 0.82 },
                notes: { value: null, confidence: 0 },
              },
            ],
          }
        : {
            manufacturer: { value: 'Straumann', confidence: 0.95 },
            system: { value: 'BLX', confidence: 0.9 },
            model: { value: 'Roxolid SLActive', confidence: 0.75 },
            diameterMm: { value: 4.0, confidence: 0.85 },
            lengthMm: { value: 10, confidence: 0.85 },
            lotNumber: { value: 'MOCK-LOT-001', confidence: 0.6 },
            placementDate: { value: null, confidence: 0 },
            tooth: { value: 14, confidence: 0.7 },
          };

    return { output, provider: 'mock', model: 'mock', promptVersion: EXTRACTION_SCHEMA_VERSION };
  }
}
