import {
  CLINICAL_REPORT_JSON_SCHEMA,
  EXTRACTION_SCHEMA_VERSION,
  IMPLANT_DOCUMENT_JSON_SCHEMA,
} from '@dental-passport/shared';
import { AiProvider, ExtractionInput, ExtractionResult } from './types';

const PROMPTS: Record<string, string> = {
  CLINICAL_REPORT:
    'You are extracting structured data from a dental clinical/treatment report. ' +
    'Extract every treatment mentioned. Teeth use FDI notation (11-48).',
  IMPLANT_DOCUMENT:
    'You are extracting structured data from a dental implant document, passport or label. ' +
    'The tooth uses FDI notation (11-48). Dimensions are in millimetres.',
};

/**
 * OpenAI implementation of the AiProvider (Stage 3 §6).
 * Core safety rule enforced by prompt AND downstream review: null for anything
 * not present in the document — the model must never invent information.
 */
export class OpenAiProvider implements AiProvider {
  constructor(
    private readonly apiKey: string,
    private readonly model = process.env.OPENAI_MODEL ?? 'gpt-4o',
  ) {}

  async extract(input: ExtractionInput): Promise<ExtractionResult> {
    const schema = input.category === 'CLINICAL_REPORT' ? CLINICAL_REPORT_JSON_SCHEMA : IMPLANT_DOCUMENT_JSON_SCHEMA;
    const prompt =
      `${PROMPTS[input.category]}\n\n` +
      `Respond with ONLY a JSON object that conforms to this JSON Schema:\n${JSON.stringify(schema)}\n\n` +
      `Rules:\n` +
      `- Every field is {"value": ..., "confidence": 0..1}.\n` +
      `- If the document does not contain the information, use value null and confidence 0. NEVER guess or invent.\n` +
      `- Dates in ISO format (YYYY-MM-DD).`;

    const base64 = input.file.toString('base64');
    const filePart =
      input.mimeType === 'application/pdf'
        ? { type: 'input_file', filename: input.filename, file_data: `data:application/pdf;base64,${base64}` }
        : { type: 'input_image', image_url: `data:${input.mimeType};base64,${base64}` };

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, filePart] }],
      }),
    });
    if (!response.ok) {
      throw new Error(`OpenAI request failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
    }

    const data = (await response.json()) as { output_text?: string; output?: { content?: { text?: string }[] }[] };
    const text =
      data.output_text ??
      data.output?.flatMap((o) => o.content ?? []).find((c) => c.text)?.text;
    if (!text) throw new Error('OpenAI returned no text output');

    // Models sometimes wrap JSON in markdown fences despite instructions.
    const jsonText = text.replace(/^```(json)?\s*/i, '').replace(/\s*```$/, '');
    return {
      output: JSON.parse(jsonText) as Record<string, unknown>,
      provider: 'openai',
      model: this.model,
      promptVersion: EXTRACTION_SCHEMA_VERSION,
    };
  }
}
