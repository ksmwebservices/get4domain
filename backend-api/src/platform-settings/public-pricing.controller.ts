import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PlatformSettingsService } from './platform-settings.service';

// Non-secret pricing defaults — the single fallback set shared by this public
// endpoint and the admin Pricing Manager, so an unset value never renders blank.
const PRICING_DEFAULTS: Record<string, number> = {
  domainapp_monthly: 999, domainapp_quarterly: 2997, domainapp_yearly: 9999,
  topup_999_credits: 1100, topup_2499_credits: 3000, topup_4999_credits: 6500,
  trial_free_credit: 100, pro_free_credit: 499,
  social_post: 5, festival_poster: 8, blog_article: 15, reel_script: 10,
  video_generation: 50, document: 15, whatsapp_message: 1, whatsapp_session: 1,
  sms_message: 0.5, email_message: 0.1, social_post_publish: 10, extra_campaign_page: 20,
};

/**
 * PUBLIC pricing read for the marketing site. The admin Pricing Manager writes
 * these into g4d_platform_settings (category 'pricing'); the /platform-settings
 * admin API is SuperAdminGuard-only, so the public marketing pricing page reads
 * from HERE instead of hardcoding — admin edits now genuinely reflect on the site
 * (the page uses ISR, so no redeploy is needed). Only non-secret price numbers are
 * exposed; API keys and other secret settings are never returned.
 */
@ApiTags('pricing')
@Controller('pricing')
export class PublicPricingController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Public pricing (subscription + top-up + per-use rates) for the marketing site' })
  async getPublicPricing() {
    const num = async (key: string): Promise<number> => {
      const raw = await this.settings.getResolvedValue('pricing', key);
      const parsed = raw != null && raw !== '' ? Number(raw) : NaN;
      return Number.isFinite(parsed) ? parsed : PRICING_DEFAULTS[key];
    };

    const [monthly, quarterly, yearly, t999, t2499, t4999, trialCredit, proCredit] = await Promise.all([
      num('domainapp_monthly'), num('domainapp_quarterly'), num('domainapp_yearly'),
      num('topup_999_credits'), num('topup_2499_credits'), num('topup_4999_credits'),
      num('trial_free_credit'), num('pro_free_credit'),
    ]);

    const usageKeys = ['social_post', 'festival_poster', 'blog_article', 'reel_script', 'video_generation', 'document', 'whatsapp_message', 'sms_message', 'email_message', 'social_post_publish', 'extra_campaign_page'];
    const usage: Record<string, number> = {};
    await Promise.all(usageKeys.map(async (k) => { usage[k] = await num(k); }));

    return {
      subscription: { monthly, quarterly, yearly },
      topups: { '999': t999, '2499': t2499, '4999': t4999 },
      freeCredit: { trial: trialCredit, pro: proCredit },
      usage,
    };
  }
}
