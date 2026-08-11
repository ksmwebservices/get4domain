import { Injectable, Logger } from '@nestjs/common';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { ProviderResult } from '../whatsapp/whatsapp.service';

const FAST2SMS_ENDPOINT = 'https://www.fast2sms.com/dev/bulkV2';
// Plain OTP route on the v1 /dev/bulk endpoint: route=otp with our own generated
// code as variables_values. Needs NO DLT and NO "website verification" — unlike
// the Smart OTP API (/dev/otp/send), which returns status_code 996 until verified.
const FAST2SMS_OTP_ENDPOINT = 'https://www.fast2sms.com/dev/bulk';

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

  /**
   * One-time password via the plain OTP route (route=otp, our own generated code
   * as variables_values). No DLT, no website verification (the Smart-OTP API
   * /dev/otp/send is the one that 996s). Tries /dev/bulk first, then falls back to
   * /dev/bulkV2 if that errors — so it works whichever endpoint the account
   * accepts. `mock` is returned only when no key is configured.
   */
  async sendOtp(to: string, code: string): Promise<ProviderResult> {
    const params = { route: 'otp', variables_values: code, numbers: this.normalize(to) };
    const primary = await this.call(params, FAST2SMS_OTP_ENDPOINT);
    if (primary.mock || primary.status === 'sent') return primary;
    this.logger.warn('OTP via /dev/bulk did not succeed — retrying on /dev/bulkV2 route=otp');
    return this.call(params, FAST2SMS_ENDPOINT);
  }
}
