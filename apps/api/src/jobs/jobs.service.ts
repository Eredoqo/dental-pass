import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PgBoss from 'pg-boss';

export const DOCUMENT_EXTRACT_QUEUE = 'document.extract';

export interface DocumentExtractJob {
  documentId: string;
  documentVersionId: string;
  [key: string]: string;
}

/**
 * Send-only pg-boss client (Stage 3 §6): the API enqueues, the worker consumes.
 * Queue and retry policy are defined here and mirrored in apps/worker.
 */
@Injectable()
export class JobsService implements OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private boss?: PgBoss;
  private starting?: Promise<PgBoss>;

  constructor(private readonly config: ConfigService) {}

  private async getBoss(): Promise<PgBoss> {
    if (this.boss) return this.boss;
    this.starting ??= (async () => {
      const boss = new PgBoss({ connectionString: this.config.get<string>('DATABASE_URL')! });
      boss.on('error', (error) => this.logger.error(`pg-boss: ${error.message}`));
      await boss.start();
      await boss.createQueue(DOCUMENT_EXTRACT_QUEUE, {
        name: DOCUMENT_EXTRACT_QUEUE,
        retryLimit: 3,
        retryDelay: 30,
        retryBackoff: true,
      });
      this.boss = boss;
      return boss;
    })();
    return this.starting;
  }

  async enqueueExtraction(job: DocumentExtractJob): Promise<string | null> {
    const boss = await this.getBoss();
    return boss.send(DOCUMENT_EXTRACT_QUEUE, job);
  }

  async onModuleDestroy() {
    await this.boss?.stop();
  }
}
