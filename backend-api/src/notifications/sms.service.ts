import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly authKey = process.env.MSG91_AUTH_KEY;
  private readonly senderId = process.env.MSG91_SENDER_ID ?? 'G4DOMN';

  get isConfigured(): boolean {
    return Boolean(this.authKey);
  }

  async send(phone: string, message: string, templateId?: string): Promise<boolean> {
    if (!this.isConfigured) {
      this.logger.warn(`SMS not configured — skipping message to ${phone}`);
      return false;
    }

    try {
      const response = await fetch('https://api.msg91.com/api/v5/flow/', {
        method: 'POST',
        headers: {
          authkey: this.authKey as string,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: templateId,
          sender: this.senderId,
          mobiles: phone.replace(/^\+/, ''),
          message,
        }),
      });

      if (!response.ok) {
        this.logger.error(`MSG91 SMS failed: ${response.status} ${await response.text()}`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error('SMS send failed', error instanceof Error ? error.stack : undefined);
      return false;
    }
  }
}
