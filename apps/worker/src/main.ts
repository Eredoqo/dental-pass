import PgBoss from 'pg-boss';
import { PrismaClient } from '@dental-passport/db';

export const DOCUMENT_EXTRACT_QUEUE = 'document.extract';

export interface DocumentExtractJob {
  documentId: string;
  documentVersionId: string;
}

/**
 * AI worker process (Stage 3 §6). Consumes pg-boss jobs from the same
 * Postgres the API writes to — job creation is transactional with the
 * document row. Retries 3x with exponential backoff, then FAILED.
 *
 * Phase 5 will plug the AiProvider pipeline into handleExtract(); the
 * queue topology and state transitions are wired now so the API side
 * can be built against them.
 */
async function main() {
  const prisma = new PrismaClient();
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
    const { documentId } = job.data;
    console.log(`[worker] extract job ${job.id} for document ${documentId}`);

    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSING' },
    });

    // Phase 5: download file -> AiProvider.extract -> validate against
    // schema v1 -> create AIExtraction + items -> REVIEW_REQUIRED.
    throw new Error('AI pipeline not implemented yet (Stage 4 Phase 5)');
  });

  console.log('[worker] listening for jobs');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
