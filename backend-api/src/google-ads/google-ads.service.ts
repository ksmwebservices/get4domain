import { Injectable, Logger } from '@nestjs/common';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

export interface AdCampaignResult {
  externalCampaignId: string;
  status: 'launched' | 'mock';
  mock: boolean;
}

/**
 * Google Ads (and Meta Ads) launch — MOCK implementation.
 * Get4Domain runs campaigns from its own MCC / Business Manager, pays upfront,
 * then invoices the vendor (ad spend + management fee). Swap the marked method
 * for the real Google Ads API once developer-token access is approved and
 * credentials are set via Admin → Integrations (google_ads category).
 */
@Injectable()
export class GoogleAdsService {
  private readonly logger = new Logger(GoogleAdsService.name);

  constructor(private readonly settings: PlatformSettingsService) {}

  async launchCampaign(params: {
    objective: string;
    budget: number;
    durationDays: number;
    audience: string;
  }): Promise<AdCampaignResult> {
    const devToken = await this.settings.getResolvedValue('google_ads', 'developer_token');

    // TODO: swap for real Google Ads API call once developer token approved.
    this.logger.log(
      `[MOCK] Google Ads launch objective=${params.objective} budget=${params.budget} days=${params.durationDays}`,
    );
    return {
      externalCampaignId: `mock_gads_${Date.now()}`,
      status: devToken ? 'launched' : 'mock',
      mock: true,
    };
  }
}
