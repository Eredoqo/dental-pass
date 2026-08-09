import PgBoss from 'pg-boss';
import { PrismaClient } from '@dental-passport/db';
import { buildProvider, DocumentExtractJob, processDocument } from './pipeline';

export const DOCUMENT_EXTRACT_QUEUE = 'document.extract';

/**
 * AI worker (Stage 3 §6). Consumes pg-boss jobs from the same Postgres the
 * API writes to. Retries 3x with exponential backoff; the pipeline leaves the
 * document FAILED after the last failed attempt (retriable via the API).
 */
async function main() {
  const prisma = new PrismaClient();
  const provider = buildProvider();
  const boss = new PgBoss({ connectionString: process.env.DATABASE_URL! });

  boss.on('error', (error) => console.error('[pg-boss]', error));
  await boss.start();
  await boss.createQueue(DOCUMENT_EXTRACT_QUEUE, {
    name: DOCUMENT_EXTRACT_QUEUE,
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true,
  });

  await boss.work<DocumentExtractJob>(DOCUMENT_EXTRACT_QUEUE, async ([job]) => {
    console.log(`[worker] job ${job.id} → document ${job.data.documentId}`);
    await processDocument(prisma, provider, job.data);
  });

  console.log('[worker] listening for jobs');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
