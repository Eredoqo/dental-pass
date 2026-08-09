/** Internal AI abstraction (D-005 in Stage 1: provider must be replaceable). */

export type ExtractableCategory = 'CLINICAL_REPORT' | 'IMPLANT_DOCUMENT';

export interface ExtractionInput {
  file: Buffer;
  mimeType: string;
  filename: string;
  category: ExtractableCategory;
}

export interface ExtractionResult {
  /** Parsed JSON matching the category's schema from @dental-passport/shared. */
  output: Record<string, unknown>;
  provider: string;
  model: string;
  promptVersion: string;
}

export interface AiProvider {
  extract(input: ExtractionInput): Promise<ExtractionResult>;
}
