import { Injectable, Logger } from '@nestjs/common';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

export interface ProviderResult {
  providerMessageId: string;
  /** sent = real delivery accepted · mock = no key configured · failed = real attempt errored */
  status: 'sent' | 'mock' | 'failed';
  mock: boolean;
  /** Provider error message when status === 'failed' (surfaced for debugging). */
  error?: string;
}

const FAST2SMS_WA_ENDPOINT = 'https://www.fast2sms.com/dev/whatsapp';

/**
 * WhatsApp provider — Fast2SMS WhatsApp API (mock-first until configured).
 * Uses Get4Domain's central Fast2SMS account (Admin → Integrations, `fast2sms`).
 * Fast2SMS sends via pre-approved WhatsApp message templates (wa_message_id);
 * `message`/`variables` fill the template. Falls back to a MOCK log when the key
 * or template id is absent. Per-vendor debit is handled by the caller.
 */
@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private readonly settings: PlatformSettingsService) {}

  private normalize(to: string): string {
    const digits = to.replace(/\D/g, '');
    return digits.length > 10 ? digits.slice(-10) : digits;
  }

  async sendMessage(to: string, message: string, templateName?: string): Promise<ProviderResult> {
    const apiKey = await this.settings.getResolvedValue('fast2sms', 'api_key');
    const messageId = templateName ?? (await this.settings.getResolvedValue('fast2sms', 'wa_message_id'));
    const numbers = this.normalize(to);

    if (!apiKey || !messageId) {
      this.logger.log(`[MOCK] WhatsApp -> ${numbers} (template=${messageId ?? 'none'}): ${message.slice(0, 60)}`);
      return { providerMessageId: `mock_wa_${Date.now()}`, status: 'mock', mock: true };
    }

    try {
      const qs = new URLSearchParams({
        authorization: apiKey,
        message_id: messageId,
        numbers,
        variables_values: message,
      }).toString();
      const res = await fetch(`${FAST2SMS_WA_ENDPOINT}?${qs}`, { method: 'GET' });
      const body = await res.text();
      let data: { return?: boolean; request_id?: string; message?: unknown } | null = null;
      try { data = JSON.parse(body); } catch { /* non-JSON */ }
      if (!res.ok || !(data?.return === true || data?.request_id)) {
        this.logger.error(`Fast2SMS WhatsApp error ${res.status}: ${body.slice(0, 300)}`);
        return { providerMessageId: `err_wa_${Date.now()}`, status: 'failed', mock: false, error: `Fast2SMS HTTP ${res.status}` };
      }
      return { providerMessageId: data?.request_id ?? `wa_${Date.now()}`, status: 'sent', mock: false };
    } catch (err) {
      this.logger.error(`Fast2SMS WhatsApp request failed: ${err instanceof Error ? err.message : 'unknown'}`);
      return { providerMessageId: `err_wa_${Date.now()}`, status: 'failed', mock: false, error: err instanceof Error ? err.message : 'network error' };
    }
  }
}
