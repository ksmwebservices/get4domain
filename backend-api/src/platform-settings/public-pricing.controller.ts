import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { PlatformSettingsService } from './platform-settings.service';

// Non-secret pricing defaults — the single fallback set shared by this public
// endpoint and the admin Pricing Manager, so an unset value never renders blank.
// DomainApp is annual-only (dispatch 01-Oct-2026): Workspace ₹11,988/yr, BOS
// ₹23,988/yr — both ex-GST.
const PRICING_DEFAULTS: Record<string, number> = {
  domainapp_workspace_yearly: 11988, domainapp_bos_yearly: 23988,
  topup_999_credits: 1100, topup_2499_credits: 3000, topup_4999_credits: 6500,
  trial_free_credit: 100, workspace_ai_credit: 499, bos_ai_credit: 1299,
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

    const [workspaceYearly, bosYearly, t999, t2499, t4999, trialCredit, workspaceAiCredit, bosAiCredit] = await Promise.all([
      num('domainapp_workspace_yearly'), num('domainapp_bos_yearly'),
      num('topup_999_credits'), num('topup_2499_credits'), num('topup_4999_credits'),
      num('trial_free_credit'), num('workspace_ai_credit'), num('bos_ai_credit'),
    ]);

    const usageKeys = ['social_post', 'festival_poster', 'blog_article', 'reel_script', 'video_generation', 'document', 'whatsapp_message', 'sms_message', 'email_message', 'social_post_publish', 'extra_campaign_page'];
    const usage: Record<string, number> = {};
    await Promise.all(usageKeys.map(async (k) => { usage[k] = await num(k); }));

    return {
      subscription: { workspaceYearly, bosYearly },
      topups: { '999': t999, '2499': t2499, '4999': t4999 },
      freeCredit: { trial: trialCredit, workspace: workspaceAiCredit, bos: bosAiCredit },
      usage,
    };
  }
}
