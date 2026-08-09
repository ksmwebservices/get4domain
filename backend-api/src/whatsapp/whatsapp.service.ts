import { Injectable, Logger } from '@nestjs/common';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

export interface ProviderResult {
  providerMessageId: string;
  status: 'sent' | 'mock';
  mock: boolean;
}

/**
 * WhatsApp BSP provider — MOCK implementation (mock-first strategy).
 * Get4Domain is the BSP intermediary; vendors get a sub-account. Swap the marked
 * method for the real BSP (Interakt/AiSensy/Gupshup) call once the partnership
 * and credentials are configured via Admin → Integrations (whatsapp category).
 */
@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private readonly settings: PlatformSettingsService) {}

  async sendMessage(to: string, message: string, templateName?: string): Promise<ProviderResult> {
    const apiKey = await this.settings.getResolvedValue('whatsapp', 'bsp_api_key');

    // TODO: swap for real Meta Graph / BSP API call once App Review + BSP
    // partnership approved. Real shape (Interakt example):
    //   POST https://api.interakt.ai/v1/public/message/
    //   headers: { Authorization: `Basic ${apiKey}` }
    //   body: { countryCode, phoneNumber: to, type: 'Template', template: { name: templateName, ... } }
    this.logger.log(`[MOCK] WhatsApp -> ${to} (template=${templateName ?? 'none'}): ${message.slice(0, 60)}`);
    return {
      providerMessageId: `mock_wa_${Date.now()}`,
      status: apiKey ? 'sent' : 'mock',
      mock: true,
    };
  }
}
