import { PrismaClient } from '@dental-passport/db';
import { MockAiProvider } from './ai/mock-provider';
import { OpenAiProvider } from './ai/openai-provider';
import { AiProvider, ExtractableCategory } from './ai/types';
import { downloadObject } from './storage';

export interface DocumentExtractJob {
  documentId: string;
  documentVersionId: string;
}

export function buildProvider(): AiProvider {
  const key = process.env.OPENAI_API_KEY;
  if (key) return new OpenAiProvider(key);
  console.warn('[worker] OPENAI_API_KEY not set — using MOCK AI provider');
  return new MockAiProvider();
}

interface ExtractedField {
  value: unknown;
  confidence?: number;
}

function asField(raw: unknown): ExtractedField {
  if (raw && typeof raw === 'object' && 'value' in raw) return raw as ExtractedField;
  return { value: null, confidence: 0 };
}

/** Flatten the schema output into reviewable AIExtractionItems (Stage 3 §6). */
function flattenItems(category: ExtractableCategory, output: Record<string, unknown>) {
  const items: { itemType: string; fieldPath: string; proposedValue: unknown; confidence: number | null }[] = [];

  const push = (itemType: string, fieldPath: string, raw: unknown) => {
    const field = asField(raw);
    items.push({
      itemType,
      fieldPath,
      proposedValue: field.value === undefined ? null : (field.value as never),
      confidence: typeof field.confidence === 'number' ? Math.max(0, Math.min(1, field.confidence)) : null,
    });
  };

  if (category === 'CLINICAL_REPORT') {
    for (const key of ['documentDate', 'clinicName', 'dentistName']) push('document', key, output[key]);
    const treatments = Array.isArray(output.treatments) ? output.treatments : [];
    treatments.forEach((t: Record<string, unknown>, i: number) => {
      for (const key of ['type', 'date', 'toothScope', 'teeth', 'notes']) {
        push('treatment', `treatments[${i}].${key}`, t?.[key]);
      }
    });
  } else {
    for (const key of ['manufacturer', 'system', 'model', 'diameterMm', 'lengthMm', 'lotNumber', 'placementDate', 'tooth']) {
      push('implant', key, output[key]);
    }
  }
  return items;
}

/**
 * Stage 2 workflow G: QUEUED → PROCESSING → (extraction) → REVIEW_REQUIRED,
 * or FAILED on error. Each retry re-enters here, so the terminal state is
 * always correct: a later successful retry overwrites FAILED.
 */
export async function processDocument(prisma: PrismaClient, provider: AiProvider, job: DocumentExtractJob) {
  const document = await prisma.document.findUnique({
    where: { id: job.documentId },
    include: { versions: { where: { id: job.documentVersionId } } },
  });
  if (!document || document.versions.length === 0) {
    console.warn(`[worker] document ${job.documentId} vanished — skipping`);
    return;
  }
  if (!['QUEUED', 'PROCESSING', 'FAILED'].includes(document.status)) {
    console.warn(`[worker] document ${document.id} in status ${document.status} — skipping`);
    return;
  }
  const category = document.category as ExtractableCategory;

  await prisma.document.update({ where: { id: document.id }, data: { status: 'PROCESSING' } });
  const extraction = await prisma.aIExtraction.create({
    data: {
      documentId: document.id,
      documentVersionId: job.documentVersionId,
      status: 'RUNNING',
      provider: 'pending',
      model: 'pending',
      promptVersion: 'pending',
      startedAt: new Date(),
    },
  });

  try {
    const file = await downloadObject(document.versions[0].storageKey);
    const result = await provider.extract({
      file,
      mimeType: document.versions[0].mimeType,
      filename: document.originalFilename,
      category,
    });

    const items = flattenItems(category, result.output);
    await prisma.$transaction([
      prisma.aIExtraction.update({
        where: { id: extraction.id },
        data: {
          status: 'SUCCEEDED',
          provider: result.provider,
          model: result.model,
          promptVersion: result.promptVersion,
          rawOutput: result.output as never,
          finishedAt: new Date(),
        },
      }),
      prisma.aIExtractionItem.createMany({
        data: items.map((item) => ({ ...item, extractionId: extraction.id, proposedValue: item.proposedValue as never })),
      }),
      prisma.document.update({ where: { id: document.id }, data: { status: 'REVIEW_REQUIRED' } }),
      prisma.auditLog.create({
        data: {
          action: 'extraction.succeeded',
          resourceType: 'AIExtraction',
          resourceId: extraction.id,
          clinicId: document.clinicId,
          metadata: { documentId: document.id, provider: result.provider, model: result.model, items: items.length },
        },
      }),
    ]);
    console.log(`[worker] document ${document.id}: ${items.length} items extracted (${result.provider}) → REVIEW_REQUIRED`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.$transaction([
      prisma.aIExtraction.update({
        where: { id: extraction.id },
        data: { status: 'FAILED', error: message.slice(0, 1000), finishedAt: new Date() },
      }),
      prisma.document.update({ where: { id: document.id }, data: { status: 'FAILED' } }),
      prisma.auditLog.create({
        data: {
          action: 'extraction.failed',
          resourceType: 'AIExtraction',
          resourceId: extraction.id,
          clinicId: document.clinicId,
          metadata: { documentId: document.id, error: message.slice(0, 300) },
        },
      }),
    ]);
    throw error; // let pg-boss retry
  }
}
