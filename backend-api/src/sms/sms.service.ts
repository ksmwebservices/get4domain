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
    const key =
      (await this.settings.getResolvedValue('fast2sms', 'api_key')) ??
      (await this.settings.getResolvedValue('sms', 'sms_api_key'));
    if (!key) {
      this.logger.warn('Fast2SMS api_key did not resolve (fast2sms/api_key or sms/sms_api_key). Check Admin → Integrations and PLATFORM_SETTINGS_KEY.');
    }
    return key;
  }

  private async call(params: Record<string, string>, endpoint: string = FAST2SMS_ENDPOINT): Promise<ProviderResult> {
    const apiKey = await this.apiKey();
    const numbers = params.numbers;

    // MOCK only when there is genuinely no key. A real attempt that errors is
    // reported as `failed` (mock:false) so the true cause is never hidden.
    if (!apiKey) {
      this.logger.log(`[MOCK] SMS -> ${numbers} (${params.route ?? 'q'}) not sent (Fast2SMS not configured)`);
      return { providerMessageId: `mock_sms_${Date.now()}`, status: 'mock', mock: true };
    }

    const url = `${endpoint}?${new URLSearchParams({ authorization: apiKey, flash: '0', ...params }).toString()}`;
    const masked = url.replace(apiKey, `${apiKey.slice(0, 4)}…`);
    try {
      const res = await fetch(url, { method: 'GET' });
      const body = await res.text();
      let data: { return?: boolean; request_id?: string; message?: unknown } | null = null;
      try { data = JSON.parse(body); } catch { /* some endpoints return non-JSON */ }

      const ok = res.ok && (data?.return === true || Boolean(data?.request_id));
      if (!ok) {
        this.logger.error(`Fast2SMS ${res.status} for ${masked} :: ${body.slice(0, 300)}`);
        const msg = Array.isArray((data as { message?: unknown })?.message)
          ? String((data as { message: unknown[] }).message[0])
          : (data as { message?: unknown })?.message
            ? String((data as { message: unknown }).message)
            : `Fast2SMS HTTP ${res.status}`;
        return { providerMessageId: `err_sms_${Date.now()}`, status: 'failed', mock: false, error: msg };
      }
      this.logger.log(`Fast2SMS sent (${params.route}) -> ${numbers} via ${endpoint}`);
      return { providerMessageId: data?.request_id ?? `sms_${Date.now()}`, status: 'sent', mock: false };
    } catch (err) {
      this.logger.error(`Fast2SMS request failed for ${masked}: ${err instanceof Error ? err.message : 'unknown'}`);
      return { providerMessageId: `err_sms_${Date.now()}`, status: 'failed', mock: false, error: err instanceof Error ? err.message : 'network error' };
    }
  }

  /**
   * Generic transactional SMS. Uses the DLT route when a sender/template is set,
   * else the quick route.
   *
   * `businessName` is the ONLY vendor-configurable part of SMS, and deliberately
   * so: the DLT sender-ID and the approved template are registered once, by
   * Get4Domain, with TRAI — a vendor cannot obtain their own without their own
   * DLT registration. What a vendor CAN own is the business name inside the body,
   * so the customer knows who is texting them.
   *
   * On the DLT route the name is passed as the leading template variable rather
   * than glued onto the message, because `variables_values` is pipe-separated and
   * a prepended string would silently shift every other variable. On the quick
   * route (plain text, no template) it is simply prefixed.
   */
  async sendSms(to: string, message: string, businessName?: string | null): Promise<ProviderResult> {
    const numbers = this.normalize(to);
    const senderId = await this.settings.getResolvedValue('fast2sms', 'sender_id');
    const messageId = await this.settings.getResolvedValue('fast2sms', 'sms_message_id');
    const entityId = await this.settings.getResolvedValue('fast2sms', 'dlt_entity_id');
    const brand = businessName?.trim().slice(0, 40) || null;

    if (senderId && messageId) {
      return this.call({
        route: 'dlt',
        sender_id: senderId,
        message: messageId,
        variables_values: brand ? `${brand}|${message}` : message,
        numbers,
        ...(entityId ? { entity_id: entityId } : {}),
      });
    }
    // Quick transactional route (no DLT template) — fine for testing / fallback.
    return this.call({ route: 'q', message: brand ? `${brand}: ${message}` : message, numbers });
  }

  /**
   * One-time password via the Quick SMS route (route=q, plain text) on bulkV2 —
   * the route confirmed working for this account. No DLT, no website verification.
   * We generate + store the code ourselves (OtpService); Fast2SMS just delivers
   * the plain message. Costs ~₹5/SMS — a cheaper DLT template route is a later
   * optimisation. `mock` is returned only when no key is configured.
   */
  async sendOtp(to: string, code: string): Promise<ProviderResult> {
    const message = `Your Get4Domain OTP is ${code}. Valid for 5 minutes.`;
    return this.call({ route: 'q', message, numbers: this.normalize(to) });
  }
}
