import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly authKey = process.env.MSG91_AUTH_KEY;
  private readonly integratedNumber = process.env.MSG91_WHATSAPP_NUMBER;

  get isConfigured(): boolean {
    return Boolean(this.authKey && this.integratedNumber);
  }

  /** Sends a WhatsApp message via an approved MSG91 WhatsApp template. No-ops with a log when not configured. */
  async sendTemplate(phone: string, templateName: string, params: string[]): Promise<boolean> {
    if (!this.isConfigured) {
      this.logger.warn(`WhatsApp not configured — skipping "${templateName}" to ${phone}`);
      return false;
    }

    try {
      const response = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/', {
        method: 'POST',
        headers: {
          authkey: this.authKey as string,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integrated_number: this.integratedNumber,
          content_type: 'template',
          payload: {
            to: phone.replace(/^\+/, ''),
            type: 'template',
            template: {
              name: templateName,
              language: { code: 'en', policy: 'deterministic' },
              components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }],
            },
          },
        }),
      });

      if (!response.ok) {
        this.logger.error(`MSG91 WhatsApp failed: ${response.status} ${await response.text()}`);
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error('WhatsApp send failed', error instanceof Error ? error.stack : undefined);
      return false;
    }
  }
}
