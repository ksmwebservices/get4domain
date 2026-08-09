import { Injectable, Logger } from '@nestjs/common';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { ProviderResult } from '../whatsapp/whatsapp.service';

/**
 * SMS provider — MOCK implementation (mock-first strategy).
 * Get4Domain holds the master MSG91/Kaleyra account; each vendor uses its own
 * DLT-registered sender ID. Swap the marked method for the real gateway call
 * once credentials are configured via Admin → Integrations (sms category).
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly settings: PlatformSettingsService) {}

  async sendSms(to: string, message: string): Promise<ProviderResult> {
    const apiKey = await this.settings.getResolvedValue('sms', 'sms_api_key');
    const senderId = await this.settings.getResolvedValue('sms', 'sms_sender_id');

    // TODO: swap for real MSG91 call once configured. Real shape:
    //   POST https://api.msg91.com/api/v5/flow/
    //   headers: { authkey: apiKey }
    //   body: { sender: senderId, mobiles: to, ... }
    this.logger.log(`[MOCK] SMS (sender=${senderId ?? 'n/a'}) -> ${to}: ${message.slice(0, 60)}`);
    return {
      providerMessageId: `mock_sms_${Date.now()}`,
      status: apiKey ? 'sent' : 'mock',
      mock: true,
    };
  }
}
