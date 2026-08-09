import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Invitation email sender (O-005: email with a secure link is the MVP mechanism).
 * Without EMAIL_PROVIDER_API_KEY (local dev) it logs the link instead of sending.
 * The Resend integration below is intentionally minimal — swap provider freely.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey?: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('EMAIL_PROVIDER_API_KEY') || undefined;
  }

  async sendPatientInvitation(to: string, clinicName: string, invitationUrl: string): Promise<void> {
    const subject = `${clinicName} invited you to Dental Passport`;
    const text =
      `${clinicName} wants to connect with you on Dental Passport.\n\n` +
      `Open this link to accept the invitation:\n${invitationUrl}\n\n` +
      `If you were not expecting this, you can ignore this email.`;

    if (!this.apiKey) {
      this.logger.log(`[dev email] to=${to} subject="${subject}" link=${invitationUrl}`);
      return;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Dental Passport <noreply@dentalpassport.app>', to, subject, text }),
    });
    if (!response.ok) {
      this.logger.error(`Email send failed (${response.status}): ${await response.text()}`);
      throw new Error('EMAIL_SEND_FAILED');
    }
  }
}
