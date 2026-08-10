import { Injectable, Logger } from '@nestjs/common';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { ProviderResult } from '../whatsapp/whatsapp.service';

const FAST2SMS_ENDPOINT = 'https://www.fast2sms.com/dev/bulkV2';

/**
 * SMS provider — Fast2SMS (mock-first until the central API key is configured).
 * Get4Domain holds ONE central Fast2SMS account (Admin → Integrations, `fast2sms`
 * category). Falls back to a MOCK log when the key is absent so dev/build never
 * breaks. Per-vendor usage is debited by the caller (Communication Hub), not here.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly settings: PlatformSettingsService) {}

  /** Digits only, stripped to a 10-digit Indian mobile (Fast2SMS wants bare numbers). */
  private normalize(to: string): string {
    const digits = to.replace(/\D/g, '');
    return digits.length > 10 ? digits.slice(-10) : digits;
  }

  private async apiKey(): Promise<string | null> {
    // Prefer the central Fast2SMS key; fall back to the legacy sms category.
    return (
      (await this.settings.getResolvedValue('fast2sms', 'api_key')) ??
      (await this.settings.getResolvedValue('sms', 'sms_api_key'))
    );
  }

  private async call(params: Record<string, string>): Promise<ProviderResult> {
    const apiKey = await this.apiKey();
    const numbers = params.numbers;

    if (!apiKey) {
      this.logger.log(`[MOCK] SMS -> ${numbers} (${params.route ?? 'q'}) not sent (Fast2SMS not configured)`);
      return { providerMessageId: `mock_sms_${Date.now()}`, status: 'mock', mock: true };
    }

    try {
      const qs = new URLSearchParams({ authorization: apiKey, flash: '0', ...params }).toString();
      const res = await fetch(`${FAST2SMS_ENDPOINT}?${qs}`, { method: 'GET' });
      const data = (await res.json()) as { return?: boolean; request_id?: string; message?: string[] };
      if (!res.ok || data.return !== true) {
        this.logger.error(`Fast2SMS SMS error ${res.status}: ${JSON.stringify(data)}`);
        return { providerMessageId: `err_sms_${Date.now()}`, status: 'mock', mock: true };
      }
      return { providerMessageId: data.request_id ?? `sms_${Date.now()}`, status: 'sent', mock: false };
    } catch (err) {
      this.logger.error(`Fast2SMS SMS request failed: ${err instanceof Error ? err.message : 'unknown'}`);
      return { providerMessageId: `err_sms_${Date.now()}`, status: 'mock', mock: true };
    }
  }

  /** Generic transactional SMS. Uses the DLT route when a sender/template is set, else the quick route. */
  async sendSms(to: string, message: string): Promise<ProviderResult> {
    const numbers = this.normalize(to);
    const senderId = await this.settings.getResolvedValue('fast2sms', 'sender_id');
    const messageId = await this.settings.getResolvedValue('fast2sms', 'sms_message_id');
    const entityId = await this.settings.getResolvedValue('fast2sms', 'dlt_entity_id');

    if (senderId && messageId) {
      return this.call({
        route: 'dlt',
        sender_id: senderId,
        message: messageId,
        variables_values: message,
        numbers,
        ...(entityId ? { entity_id: entityId } : {}),
      });
    }
    // Quick transactional route (no DLT template) — fine for testing / fallback.
    return this.call({ route: 'q', message, numbers });
  }

  /** One-time password via Fast2SMS's dedicated OTP route ("Your OTP: <code>"). */
  async sendOtp(to: string, code: string): Promise<ProviderResult> {
    return this.call({ route: 'otp', variables_values: code, numbers: this.normalize(to) });
  }
}
