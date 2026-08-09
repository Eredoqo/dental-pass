import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const BUCKET = 'documents';

/**
 * Private Supabase Storage access (Stage 3 §7). Only the API/worker hold the
 * service key — clients never talk to storage directly; they get short-lived
 * signed URLs from us after authorization.
 */
@Injectable()
export class StorageService {
  private readonly baseUrl: string;
  private readonly serviceKey: string;

  constructor(config: ConfigService) {
    this.baseUrl = `${config.get<string>('SUPABASE_URL')}/storage/v1`;
    this.serviceKey = config.get<string>('SUPABASE_SERVICE_ROLE_KEY')!;
  }

  private headers(extra: Record<string, string> = {}) {
    return { Authorization: `Bearer ${this.serviceKey}`, ...extra };
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/object/${BUCKET}/${key}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': contentType, 'x-upsert': 'false' }),
      body: new Uint8Array(body),
    });
    if (!response.ok) {
      throw new InternalServerErrorException({
        code: 'STORAGE_UPLOAD_FAILED',
        message: `Storage upload failed (${response.status})`,
      });
    }
  }

  /** 120-second signed URL (Stage 3 §7); every issuance must be audited by the caller. */
  async signedUrl(key: string, expiresInSeconds = 120): Promise<string> {
    const response = await fetch(`${this.baseUrl}/object/sign/${BUCKET}/${key}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ expiresIn: expiresInSeconds }),
    });
    if (!response.ok) {
      throw new InternalServerErrorException({ code: 'STORAGE_SIGN_FAILED', message: 'Could not sign URL' });
    }
    const { signedURL } = (await response.json()) as { signedURL: string };
    return `${this.baseUrl}${signedURL}`;
  }

  async download(key: string): Promise<Buffer> {
    const response = await fetch(`${this.baseUrl}/object/${BUCKET}/${key}`, { headers: this.headers() });
    if (!response.ok) {
      throw new InternalServerErrorException({ code: 'STORAGE_DOWNLOAD_FAILED', message: 'Could not download object' });
    }
    return Buffer.from(await response.arrayBuffer());
  }

  async remove(keys: string[]): Promise<void> {
    const response = await fetch(`${this.baseUrl}/object/${BUCKET}`, {
      method: 'DELETE',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefixes: keys }),
    });
    if (!response.ok) {
      throw new InternalServerErrorException({ code: 'STORAGE_DELETE_FAILED', message: 'Could not delete objects' });
    }
  }
}
