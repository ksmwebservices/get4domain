import { Injectable } from '@nestjs/common';
import { StepError } from '../provisioning.errors';
import { ProvisioningStep, StepContext, StepResult } from '../runner/job-runner.service';
import { SiteProvisioner } from '../site/site-provisioner';
import { parseBusinessInput } from './business-input';

/** Step 3. Asks the SiteProvisioner port for a DRAFT Free site. The site is never published here. */
@Injectable()
export class CreateFreeSiteDraftStep implements ProvisioningStep {
  readonly key = 'CREATE_FREE_SITE_DRAFT' as const;
  constructor(private readonly site: SiteProvisioner) {}

  async run(ctx: StepContext): Promise<StepResult> {
    if (!ctx.vendorId) throw new StepError('UNKNOWN_VENDOR', false);
    const b = parseBusinessInput(ctx.input);
    const { siteId } = await this.site.createDraftSite({
      vendorId: ctx.vendorId, track: b.track, category: b.category, businessName: b.businessName, language: b.language, city: b.city, phone: b.phone,
    });
    return { outputRef: { siteId } };
  }
}
